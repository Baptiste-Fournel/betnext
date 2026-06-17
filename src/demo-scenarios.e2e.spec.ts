import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { TOKEN_SERVICE, TokenService } from './contexts/identity/application/ports/TokenService';
import { PAYMENT_GATEWAY } from './contexts/wallet/application/ports/PaymentGateway';
import { StubPaymentGateway } from './contexts/wallet/infrastructure/payment/StubPaymentGateway';

// Les 4 scénarios de démonstration de la soutenance (BET-25). Chaque test prouve, bout en bout
// (HTTP réel, in-memory, PSP stub déterministe), la VALEUR d'un choix d'archi :
//   1. Ajouter un jeu      → Catalog générique N-issues : un jeu inédit traverse tout le cycle
//                            (créer marché → parier → régler) SANS une ligne de code modifiée.
//   2. Ajouter un type     → couture SettlementStrategy : EXACT_SCORE réglé via le MÊME moteur,
//                            grâce à +1 fichier + 1 enregistrement (cf. betting.module.ts).
//   3. Changer une règle   → compliance (BET-13) : le plafond quotidien prend effet IMMÉDIATEMENT.
//   4. Erreur de paiement  → Saga (BET-17) : crédit aval en échec → remboursement PSP idempotent
//                            (money-safety : jamais de charge sans crédit, jamais de double-refund).
describe('BetNext — 4 scénarios de démonstration (e2e, BET-25)', () => {
  let app: INestApplication;
  let managerTok = '';

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();
  const auth = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const registerAndLogin = async (
    username: string,
    password = 'password1',
  ): Promise<{ token: string; userId: string }> => {
    await request(server()).post('/auth/register').send({ username, password }).expect(201);
    const res = await request(server())
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    return { token: res.body.token as string, userId: res.body.userId as string };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    managerTok = app
      .get<TokenService>(TOKEN_SERVICE)
      .sign({ userId: 'mgr-demo', role: 'MANAGER' }).token;
  });
  afterAll(async () => {
    await app.close();
  });

  // --- Scénario 1 : AJOUTER UN JEU (extensibilité Catalog N-issues, zéro réécriture) -------------
  it('shouldRunFullBettingLifecycleForBrandNewGame_WhenManagerAddsAGameWithZeroCodeChange', async () => {
    // Given — un jeu jamais vu par la plateforme (ni LoL, ni esports déjà câblé). Le Catalog est
    // générique (le jeu est une donnée, pas du code) : aucun fichier n'a été modifié pour ce jeu.
    const { token: playerTok } = await registerAndLogin('valorant-player');

    // When — le gestionnaire crée un marché 3-issues sur ce nouveau jeu
    const market = await request(server())
      .post('/markets')
      .set(...auth(managerTok))
      .send({
        name: 'VCT — Sentinels vs Fnatic',
        game: 'Valorant',
        outcomes: ['SEN', 'FNC', 'nul'],
      })
      .expect(201);

    // Then — le marché existe, porté par le jeu inédit, et est bettable publiquement
    expect(market.body.game).toBe('Valorant');
    const outcomeIds = market.body.outcomes.map((o: { id: string }) => o.id) as string[];
    const winningOutcomeId = outcomeIds[0]; // victoire Sentinels
    const listed = await request(server()).get('/markets').expect(200);
    expect(listed.body.some((m: { id: string }) => m.id === market.body.id)).toBe(true);

    // When — un joueur parie à NOTRE cote figée sur une issue de ce nouveau jeu…
    const placed = await request(server())
      .post('/bets')
      .set(...auth(playerTok))
      .set('Idempotency-Key', 'valorant-bet-1')
      .send({ outcomeId: winningOutcomeId, stake: 10 })
      .expect(201);
    expect(placed.body.lockedOdds).toBeGreaterThan(0);

    // …et le gestionnaire règle le marché du jeu inédit via le MÊME moteur de règlement
    const settled = await request(server())
      .post('/markets/settle')
      .set(...auth(managerTok))
      .send({ outcomes: outcomeIds, winningOutcomeId })
      .expect(200);

    // Then — cycle complet OK sans une ligne de code propre au jeu : le pari gagne
    expect(settled.body.won).toBe(1);
    const bet = await request(server())
      .get(`/bets/${placed.body.betId}`)
      .set(...auth(playerTok))
      .expect(200);
    expect(bet.body.status).toBe('WON');
  });

  // --- Scénario 2 : AJOUTER UN TYPE DE PARI (couture SettlementStrategy, +fichier +1 registration)
  it('shouldSettleViaNewExactScoreStrategy_WhenBetTypeRegisteredWithoutRewritingTheEngine', async () => {
    // Given — un joueur place deux paris « score exact » : une grille juste, une fausse.
    // Issues de score propres au test (pas de collision avec les autres scénarios).
    const { token } = await registerAndLogin('exact-score-player');
    const place = (key: string, outcomeId: string): request.Test =>
      request(server())
        .post('/bets')
        .set(...auth(token))
        .set('Idempotency-Key', key)
        .send({ outcomeId, stake: 10 });
    const exactBet = await place('es-bet-win', 'es-2-1').expect(201); // pronostic 2-1 (exact)
    const wrongBet = await place('es-bet-lose', 'es-1-0').expect(201); // pronostic 1-0 (faux)

    // When — règlement avec la NOUVELLE stratégie, sélectionnée par clé. Si EXACT_SCORE n'était pas
    // enregistrée, la factory lèverait → settled:0, failed:2. Le succès PROUVE l'enregistrement.
    const settled = await request(server())
      .post('/markets/settle')
      .set(...auth(managerTok))
      .send({
        outcomes: ['es-2-1', 'es-1-0', 'es-2-0', 'es-0-2'],
        winningOutcomeId: 'es-2-1',
        strategyKey: 'EXACT_SCORE',
      })
      .expect(200);

    // Then — la grille exacte gagne, la fausse perd, aucun échec
    expect(settled.body).toMatchObject({ settled: 2, failed: 0, won: 1, lost: 1 });
    const won = await request(server())
      .get(`/bets/${exactBet.body.betId}`)
      .set(...auth(token))
      .expect(200);
    expect(won.body.status).toBe('WON');
    const lost = await request(server())
      .get(`/bets/${wrongBet.body.betId}`)
      .set(...auth(token))
      .expect(200);
    expect(lost.body.status).toBe('LOST');

    // And — la couture est ADDITIVE : la stratégie par défaut (1N2) reste opérationnelle, inchangée
    await place('es-default-1n2', 'es-default-win').expect(201);
    const defaultSettle = await request(server())
      .post('/markets/settle')
      .set(...auth(managerTok))
      .send({ outcomes: ['es-default-win'], winningOutcomeId: 'es-default-win' })
      .expect(200);
    expect(defaultSettle.body.won).toBe(1);
  });

  // --- Scénario 3 : CHANGER UNE RÈGLE JOUEUR (plafond quotidien, effet immédiat) -----------------
  it('shouldEnforceTheNewCapImmediately_WhenPlayerChangesOwnDailyCap', async () => {
    // Given — un joueur fixe un plafond quotidien de 40 €
    const { token } = await registerAndLogin('cap-demo-player');
    const setCap = (cap: number): request.Test =>
      request(server())
        .put('/responsible-gaming/daily-cap')
        .set(...auth(token))
        .send({ cap });
    const place = (key: string, stake: number): request.Test =>
      request(server())
        .post('/bets')
        .set(...auth(token))
        .set('Idempotency-Key', key)
        .send({ outcomeId: 'cap-o1', stake });
    await setCap(40).expect(200);

    // When / Then — sous le plafond OK ; le pari qui le dépasserait est refusé (30+30 > 40)
    await place('cap-demo-1', 30).expect(201);
    await place('cap-demo-2', 30).expect(403);

    // When — le joueur RELÈVE son plafond à 80 €…
    await setCap(80).expect(200);
    // Then — effet IMMÉDIAT, sans redémarrage : le même pari de 30 passe (total 60 ≤ 80)
    await place('cap-demo-3', 30).expect(201);

    // When — il ABAISSE son plafond à 50 €…
    await setCap(50).expect(200);
    // Then — effet immédiat dans l'autre sens : un pari de plus dépasserait (60+30 > 50) → refus
    await place('cap-demo-4', 30).expect(403);
  });

  // --- Scénario 4 : REFUND SUR ERREUR DE PAIEMENT (compensation de Saga, money-safety) -----------
  it('shouldRefundChargeIdempotently_WhenDownstreamCreditFailsAfterPayment', async () => {
    // Given — un joueur dont le wallet n'a PAS été ouvert : le crédit aval va échouer APRÈS la
    // charge PSP réussie → la Saga doit compenser (rembourser) pour ne jamais encaisser sans créditer.
    const { token } = await registerAndLogin('refund-demo-player');
    const gateway = app.get<StubPaymentGateway>(PAYMENT_GATEWAY);
    const chargesBefore = gateway.chargeCount;
    const refundsBefore = gateway.refundCount;

    // When — dépôt de 50 € : charge OK, crédit KO (wallet introuvable) → compensation
    await request(server())
      .post('/wallet/deposit')
      .set(...auth(token))
      .set('Idempotency-Key', 'refund-dep-1')
      .send({ amount: 50 })
      .expect(422);

    // Then — money-safety : exactement 1 charge et 1 remboursement (l'argent est rendu), solde nul
    expect(gateway.chargeCount).toBe(chargesBefore + 1);
    expect(gateway.refundCount).toBe(refundsBefore + 1);
    const balance = await request(server())
      .get('/wallet/balance')
      .set(...auth(token))
      .expect(200);
    expect(balance.body.balance).toBeNull();

    // When — rejeu du MÊME dépôt (retry réseau) : la compensation est idempotente par clé
    await request(server())
      .post('/wallet/deposit')
      .set(...auth(token))
      .set('Idempotency-Key', 'refund-dep-1')
      .send({ amount: 50 })
      .expect(422);

    // Then — aucun double-charge, aucun double-refund (exactly-once de bout en bout)
    expect(gateway.chargeCount).toBe(chargesBefore + 1);
    expect(gateway.refundCount).toBe(refundsBefore + 1);
  });
});
