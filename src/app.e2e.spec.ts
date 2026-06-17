import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { TOKEN_SERVICE, TokenService } from './contexts/identity/application/ports/TokenService';

describe('BetNext API (e2e, auth BET-20)', () => {
  let app: INestApplication;
  let tokenA = '';
  let userIdA = '';
  let tokenB = '';
  let managerTok = '';

  const server = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();
  const auth = (t: string): [string, string] => ['Authorization', `Bearer ${t}`];
  const register = (username: string, password = 'password1'): request.Test =>
    request(server()).post('/auth/register').send({ username, password });
  const login = async (
    username: string,
    password = 'password1',
  ): Promise<{ token: string; userId: string; role: string }> => {
    const res = await request(server())
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    return res.body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await register('alice').expect(201);
    await register('bob').expect(201);
    ({ token: tokenA, userId: userIdA } = await login('alice'));
    ({ token: tokenB } = await login('bob'));
    managerTok = app
      .get<TokenService>(TOKEN_SERVICE)
      .sign({ userId: 'mgr-1', role: 'MANAGER' }).token;
  });
  afterAll(async () => {
    await app.close();
  });

  it('shouldReturn200WithStatusOk_WhenGettingHealthPublicly', async () => {
    // When / Then
    const res = await request(server()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('shouldReturn401_WhenPostingBetWithoutToken', async () => {
    // When / Then
    await request(server())
      .post('/bets')
      .set('Idempotency-Key', 'no-auth')
      .send({ outcomeId: 'o1', stake: 10 })
      .expect(401);
  });

  it('shouldReturn201WithLockedOdds_WhenPlayerPostsBetWithKey', async () => {
    // When
    const res = await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'k-201')
      .send({ outcomeId: 'o1', stake: 20 })
      .expect(201);

    // Then
    expect(res.body).toMatchObject({ lockedOdds: 2, potentialGain: 40 });
  });

  it('shouldReturn400Or422_WhenPostingBetWithMissingKeyOrInvalidBodyOrNonPositiveStake', async () => {
    // When / Then
    await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .send({ outcomeId: 'o1', stake: 10 })
      .expect(400);
    await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'k-bad')
      .send({})
      .expect(400);
    await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'k-neg')
      .send({ outcomeId: 'o1', stake: -5 })
      .expect(422);
  });

  it('shouldReturnSameBetIdOr409_WhenReplayingKeyWithSameOrDifferentBody', async () => {
    // When
    const r1 = await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'idem-1')
      .send({ outcomeId: 'o1', stake: 15 })
      .expect(201);
    const r2 = await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'idem-1')
      .send({ outcomeId: 'o1', stake: 15 })
      .expect(201);

    // Then
    expect(r2.body.betId).toBe(r1.body.betId);
    await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'idem-1')
      .send({ outcomeId: 'o1', stake: 99 })
      .expect(409);
  });

  it('shouldServeOpeningOddsOnColdAndReadOwnBet_WhenReadingScopedReadModel', async () => {
    // When / Then — read-model froid : on sert la ligne d'ouverture (plus de 404)
    const cold = await request(server()).get('/odds/cold-outcome').expect(200);
    expect(cold.body).toMatchObject({ outcomeId: 'cold-outcome', opening: true });
    expect(typeof cold.body.odds).toBe('number');
    const post = await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'ryw-1')
      .send({ outcomeId: 'o-ryw', stake: 20 })
      .expect(201);
    const get = await request(server())
      .get(`/bets/${post.body.betId}`)
      .set(...auth(tokenA))
      .expect(200);
    expect(get.body).toMatchObject({ betId: post.body.betId, status: 'PENDING', userId: userIdA });
  });

  it('shouldReturn404NeverTheData_WhenPlayerReadsAnotherPlayersBet', async () => {
    // Given
    const post = await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'idor-1')
      .send({ outcomeId: 'o-idor', stake: 10 })
      .expect(201);
    const betId = post.body.betId as string;

    // When / Then
    await request(server())
      .get(`/bets/${betId}`)
      .set(...auth(tokenA))
      .expect(200);
    await request(server())
      .get(`/bets/${betId}`)
      .set(...auth(tokenB))
      .expect(404);
    await request(server())
      .get(`/bets/${betId}/events`)
      .set(...auth(tokenB))
      .expect(404);
  });

  it('shouldReturnOnlyCallersBets_WhenListingBets', async () => {
    // When
    const listB = await request(server())
      .get('/bets')
      .set(...auth(tokenB))
      .expect(200);

    // Then
    expect((listB.body as Array<{ userId: string }>).every((b) => b.userId !== userIdA)).toBe(true);
    const listA = await request(server())
      .get('/bets')
      .set(...auth(tokenA))
      .expect(200);
    expect((listA.body as Array<{ userId: string }>).length).toBeGreaterThan(0);
    expect((listA.body as Array<{ userId: string }>).every((b) => b.userId === userIdA)).toBe(true);
  });

  it('shouldReturn403ForPlayerAndAllowManager_WhenAccessingManagerEndpoints', async () => {
    // When / Then
    await request(server())
      .post('/markets')
      .set(...auth(tokenA))
      .send({ name: 'X', game: 'LoL', outcomes: ['a', 'b'] })
      .expect(403);
    await request(server())
      .post('/markets')
      .set(...auth(managerTok))
      .send({ name: 'X', game: 'LoL', outcomes: ['a', 'b'] })
      .expect(201);
    await request(server())
      .post('/wallet/open')
      .set(...auth(tokenA))
      .send({ userId: 'someone', openingBalance: 100 })
      .expect(403);
    await request(server())
      .post('/wallet/open')
      .set(...auth(managerTok))
      .send({ userId: 'seed-by-mgr', openingBalance: 100 })
      .expect(200);
    await request(server())
      .get('/admin/reconciliation')
      .set(...auth(tokenA))
      .expect(403);
    await request(server())
      .get('/admin/reconciliation')
      .set(...auth(managerTok))
      .expect(200);
  });

  it('shouldReturn401WithoutTokenAnd403ForPlayerAnd200ForManager_WhenSettlingMarket', async () => {
    // When / Then
    await request(server())
      .post('/markets/settle')
      .send({ outcomes: ['mA'] })
      .expect(401);
    await request(server())
      .post('/markets/settle')
      .set(...auth(tokenA))
      .send({ outcomes: ['mA'], winningOutcomeId: 'mA' })
      .expect(403);
    await request(server())
      .post('/bets')
      .set(...auth(tokenA))
      .set('Idempotency-Key', 'settle-1')
      .send({ outcomeId: 'mWin', stake: 10 })
      .expect(201);
    const res = await request(server())
      .post('/markets/settle')
      .set(...auth(managerTok))
      .send({ outcomes: ['mWin'], winningOutcomeId: 'mWin' })
      .expect(200);
    expect(res.body).toMatchObject({ won: 1 });
  });

  it('shouldReturn403_WhenPlayerExceedsOwnDailyCap', async () => {
    // Given
    const { token } = await (async (): Promise<{ token: string }> => {
      await register('capUser').expect(201);
      return login('capUser');
    })();
    await request(server())
      .put('/responsible-gaming/daily-cap')
      .set('Authorization', `Bearer ${token}`)
      .send({ cap: 50 })
      .expect(200);
    const place = (key: string, stake: number): request.Test =>
      request(server())
        .post('/bets')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({ outcomeId: 'o1', stake });

    // When / Then
    await place('cap-1', 20).expect(201);
    await place('cap-2', 20).expect(201);
    await place('cap-3', 20).expect(403);
  });

  it('shouldCreateOnlyPlayerAndReturn403OnSettle_WhenRegisteringWithManagerRole', async () => {
    // Given
    await request(server())
      .post('/auth/register')
      .send({ username: 'wannabe', password: 'password1', role: 'MANAGER' })
      .expect(201);

    // When
    const { token, role } = await login('wannabe');

    // Then
    expect(role).toBe('PLAYER');
    await request(server())
      .post('/markets/settle')
      .set('Authorization', `Bearer ${token}`)
      .send({ outcomes: ['z'], winningOutcomeId: 'z' })
      .expect(403);
  });
});
