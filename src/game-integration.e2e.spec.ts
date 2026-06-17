import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { TOKEN_SERVICE, TokenService } from './contexts/identity/application/ports/TokenService';

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

  it('shouldAutoSettleWonBetAndStayExactlyOnceOnResync_WhenManagerLinksAndSyncsMatch', async () => {
    // Given
    const markets = await request(server()).get('/markets').expect(200);
    const market = markets.body[0];
    const outcomes: string[] = market.outcomes.map((o: { id: string }) => o.id);

    const placed = await request(server())
      .post('/bets')
      .set(...bearer(playerTok))
      .set('Idempotency-Key', 'rio-bet-1')
      .send({ outcomeId: outcomes[0], stake: 20 })
      .expect(201);
    const betId = placed.body.betId as string;

    await request(server())
      .post('/game-integration/matches')
      .set(...bearer(managerTok))
      .send({
        matchId,
        outcomes,
        mapping: { HOME: outcomes[0], AWAY: outcomes[1], DRAW: outcomes[2] },
      })
      .expect(200);

    // When
    const sync = await request(server())
      .post(`/game-integration/matches/${matchId}/sync`)
      .set(...bearer(managerTok))
      .expect(200);

    // Then
    expect(sync.body).toMatchObject({ status: 'SETTLED', resolution: 'WON_OUTCOME' });
    expect(sync.body.summary.won).toBeGreaterThanOrEqual(1);

    const bet = await request(server())
      .get(`/bets/${betId}`)
      .set(...bearer(playerTok))
      .expect(200);
    expect(bet.body.status).toBe('WON');

    const resync = await request(server())
      .post(`/game-integration/matches/${matchId}/sync`)
      .set(...bearer(managerTok))
      .expect(200);
    expect(resync.body.summary).toMatchObject({ settled: 0, won: 0 });
  });

  it('shouldReturn401WithoutTokenAnd403ForPlayer_WhenAccessingManagerSyncEndpoint', async () => {
    // When / Then
    await request(server()).post(`/game-integration/matches/${matchId}/sync`).expect(401);
    await request(server())
      .post(`/game-integration/matches/${matchId}/sync`)
      .set(...bearer(playerTok))
      .expect(403);
  });
});
