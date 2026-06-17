import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { TOKEN_SERVICE, TokenService } from './contexts/identity/application/ports/TokenService';

/**
 * E2E intégration Riot (BET-21, mode mémoire, SANS clé → StubRiotClient). Prouve bout-à-bout :
 * lier un match ↔ marché → synchroniser → règlement AUTO du pari joueur, exactly-once au rejeu,
 * endpoints réservés au MANAGER. L'app démarre sans RIOT_API_KEY.
 */
describe('BetNext intégration Riot (e2e, BET-21)', () => {
  let app: INestApplication;
  let playerTok = '';
  let managerTok = '';
  const matchId = 'EUW1_DEMO_1';

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();
  const bearer = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await request(server())
      .post('/auth/register')
      .send({ username: 'rio-player', password: 'password1' });
    const login = await request(server())
      .post('/auth/login')
      .send({ username: 'rio-player', password: 'password1' });
    playerTok = login.body.token;
    managerTok = app
      .get<TokenService>(TOKEN_SERVICE)
      .sign({ userId: 'mgr-rio', role: 'MANAGER' }).token;
  });
  afterAll(async () => {
    await app.close();
  });

  it('flux complet : lier → poser → synchroniser → règlement AUTO, puis rejeu exactly-once', async () => {
    // marché de démo (catalogue en mémoire)
    const markets = await request(server()).get('/markets').expect(200);
    const market = markets.body[0];
    const outcomes: string[] = market.outcomes.map((o: { id: string }) => o.id);

    // un joueur parie sur la 1re issue
    const placed = await request(server())
      .post('/bets')
      .set(...bearer(playerTok))
      .set('Idempotency-Key', 'rio-bet-1')
      .send({ outcomeId: outcomes[0], stake: 20 })
      .expect(201);
    const betId = placed.body.betId as string;

    // le manager lie le match au marché (HOME = 1re issue gagnante)
    await request(server())
      .post('/game-integration/matches')
      .set(...bearer(managerTok))
      .send({
        matchId,
        outcomes,
        mapping: { HOME: outcomes[0], AWAY: outcomes[1], DRAW: outcomes[2] },
      })
      .expect(200);

    // synchro → le stub renvoie HOME gagnant → règlement automatique
    const sync = await request(server())
      .post(`/game-integration/matches/${matchId}/sync`)
      .set(...bearer(managerTok))
      .expect(200);
    expect(sync.body).toMatchObject({ status: 'SETTLED', resolution: 'WON_OUTCOME' });
    expect(sync.body.summary.won).toBeGreaterThanOrEqual(1);

    // le pari du joueur est WON
    const bet = await request(server())
      .get(`/bets/${betId}`)
      .set(...bearer(playerTok))
      .expect(200);
    expect(bet.body.status).toBe('WON');

    // RE-synchroniser ne re-règle RIEN (exactly-once : plus aucun pari en attente)
    const resync = await request(server())
      .post(`/game-integration/matches/${matchId}/sync`)
      .set(...bearer(managerTok))
      .expect(200);
    expect(resync.body.summary).toMatchObject({ settled: 0, won: 0 });
  });

  it('endpoints réservés au MANAGER : 401 sans token, 403 pour un joueur', async () => {
    await request(server()).post(`/game-integration/matches/${matchId}/sync`).expect(401);
    await request(server())
      .post(`/game-integration/matches/${matchId}/sync`)
      .set(...bearer(playerTok))
      .expect(403);
  });
});
