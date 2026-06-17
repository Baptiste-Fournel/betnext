import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { TOKEN_SERVICE, TokenService } from './contexts/identity/application/ports/TokenService';

describe('BetNext feed matchs pro à venir (e2e, BET-30)', () => {
  let app: INestApplication;
  let playerTok = '';
  let managerTok = '';

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();
  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];

  beforeAll(async () => {
    // Désactive le rate-limit pour exercer l'exactly-once du GARDE de settlement (pas du throttle).
    process.env.ESPORTS_SYNC_MIN_INTERVAL_MS = '0';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await request(server())
      .post('/auth/register')
      .send({ username: 'feed-player', password: 'password1' });
    const login = await request(server())
      .post('/auth/login')
      .send({ username: 'feed-player', password: 'password1' });
    playerTok = login.body.token;
    managerTok = app
      .get<TokenService>(TOKEN_SERVICE)
      .sign({ userId: 'mgr-feed', role: 'MANAGER' }).token;
  });
  afterAll(async () => {
    delete process.env.ESPORTS_SYNC_MIN_INTERVAL_MS;
    await app.close();
  });

  it('shouldIngestUpcomingMatchesAsBettableMarketsIdempotently_WhenManagerTriggersIngest', async () => {
    // Given — sans ESPORTS_API_BASE_URL en test, la source est en mode fixtures (déterministe)
    // When — premier pull
    const first = await request(server())
      .post('/game-integration/esports/ingest')
      .set(...bearer(managerTok))
      .expect(200);

    // Then — des marchés bettables sont créés et la source est signalée
    expect(first.body.source).toBe('fixtures');
    expect(first.body.ingested).toBeGreaterThanOrEqual(1);

    // les matchs à venir apparaissent dans la liste publique avec ligue + kickoff
    const upcoming = await request(server()).get('/game-integration/upcoming').expect(200);
    const lec = upcoming.body.find((u: { league: string | null }) => u.league === 'LEC');
    expect(lec).toBeDefined();
    expect(typeof lec.startTime).toBe('string');
    // et le marché correspondant est bettable publiquement
    const markets = await request(server()).get('/markets').expect(200);
    expect(markets.body.some((m: { id: string }) => m.id === lec.marketId)).toBe(true);

    // When — re-pull (idempotence)
    const second = await request(server())
      .post('/game-integration/esports/ingest')
      .set(...bearer(managerTok))
      .expect(200);

    // Then — aucun marché dupliqué : tout est skippé
    expect(second.body.ingested).toBe(0);
    expect(second.body.skipped).toBe(first.body.total);
  });

  it('shouldLetPlayerBetOnIngestedUpcomingMarketAtOurOwnLockedOdds_WhenMarketIsBettable', async () => {
    // Given — un marché issu du feed + un wallet approvisionné par le gestionnaire
    const upcoming = await request(server()).get('/game-integration/upcoming').expect(200);
    const marketId = upcoming.body[0].marketId as string;
    const markets = await request(server()).get('/markets').expect(200);
    const market = markets.body.find((m: { id: string }) => m.id === marketId);
    const outcomeId = market.outcomes[0].id as string;

    const me = await request(server())
      .get('/auth/me')
      .set(...bearer(playerTok))
      .expect(200);
    await request(server())
      .post('/wallet/open')
      .set(...bearer(managerTok))
      .send({ userId: me.body.userId, openingBalance: 100 })
      .expect(200);

    // When — le joueur parie à la cote figée (NOTRE pricing, pas une cote externe)
    const placed = await request(server())
      .post('/bets')
      .set(...bearer(playerTok))
      .set('Idempotency-Key', 'feed-bet-1')
      .send({ outcomeId, stake: 10 })
      .expect(201);

    // Then
    expect(placed.body.betId).toBeDefined();
    expect(placed.body.lockedOdds).toBeGreaterThan(0);
  });

  it('shouldAutoSettleFinishedFeedMatchAndStayExactlyOnceOnResync_WhenManagerSyncsResults', async () => {
    // Given — un compte dédié, son wallet approvisionné, un pari sur le match LEC « terminé »
    // (fixture G2 vs Fnatic → G2/HOME gagne). On part de /upcoming pour récupérer son marché.
    await request(server())
      .post('/auth/register')
      .send({ username: 'auto-bettor', password: 'password1' });
    const login = await request(server())
      .post('/auth/login')
      .send({ username: 'auto-bettor', password: 'password1' });
    const bettorTok = login.body.token as string;
    const me = await request(server())
      .get('/auth/me')
      .set(...bearer(bettorTok))
      .expect(200);
    await request(server())
      .post('/wallet/open')
      .set(...bearer(managerTok))
      .send({ userId: me.body.userId, openingBalance: 100 })
      .expect(200);

    const upcoming = await request(server()).get('/game-integration/upcoming').expect(200);
    const lec = upcoming.body.find((u: { league: string | null }) => u.league === 'LEC');
    const markets = await request(server()).get('/markets').expect(200);
    const lecMarket = markets.body.find((m: { id: string }) => m.id === lec.marketId);
    const homeOutcomeId = lecMarket.outcomes[0].id as string; // Victoire G2 Esports (HOME)

    const placed = await request(server())
      .post('/bets')
      .set(...bearer(bettorTok))
      .set('Idempotency-Key', 'auto-settle-bet-1')
      .send({ outcomeId: homeOutcomeId, stake: 20 })
      .expect(201);
    const betId = placed.body.betId as string;

    // When — le gestionnaire synchronise les résultats (récupération auto → règlement)
    const sync = await request(server())
      .post('/game-integration/esports/sync-results')
      .set(...bearer(managerTok))
      .expect(200);

    // Then — le match terminé est réglé, le pari gagne, exactly-once
    expect(sync.body.finished).toBeGreaterThanOrEqual(1);
    expect(sync.body.settledBets).toBeGreaterThanOrEqual(1);
    expect(sync.body.won).toBeGreaterThanOrEqual(1);
    const bet = await request(server())
      .get(`/bets/${betId}`)
      .set(...bearer(bettorTok))
      .expect(200);
    expect(bet.body.status).toBe('WON');

    // When — rejeu de la synchro
    const resync = await request(server())
      .post('/game-integration/esports/sync-results')
      .set(...bearer(managerTok))
      .expect(200);

    // Then — aucun pari re-réglé (pas de double-crédit) : exactly-once prouvé
    expect(resync.body.settledBets).toBe(0);
    expect(resync.body.won).toBe(0);
    const betAgain = await request(server())
      .get(`/bets/${betId}`)
      .set(...bearer(bettorTok))
      .expect(200);
    expect(betAgain.body.status).toBe('WON');
  });

  it('shouldGuardSyncResultsEndpointForManagerRole_WhenAccessControlChecked', async () => {
    // When / Then
    await request(server()).post('/game-integration/esports/sync-results').expect(401);
    await request(server())
      .post('/game-integration/esports/sync-results')
      .set(...bearer(playerTok))
      .expect(403);
  });

  it('shouldGuardIngestEndpointForManagerRole_WhenAccessControlChecked', async () => {
    // When / Then
    await request(server()).post('/game-integration/esports/ingest').expect(401);
    await request(server())
      .post('/game-integration/esports/ingest')
      .set(...bearer(playerTok))
      .expect(403);
  });

  it('shouldExposeUpcomingListPublicly_WhenNoToken', async () => {
    // When / Then — la liste des matchs à venir est publique (le joueur n'est pas authentifié ici)
    await request(server()).get('/game-integration/upcoming').expect(200);
  });
});
