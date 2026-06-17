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

  it('shouldFeatureMatchCreateMarketSettleWonBetAndStayExactlyOnceOnResync_WhenManagerFeaturesRiotMatch', async () => {
    // Given — le gestionnaire feature un match Riot en one-step (crée marché + lien)
    const featuredMatchId = 'EUW1_FEATURED_E2E';
    const featured = await request(server())
      .post('/game-integration/featured')
      .set(...bearer(managerTok))
      .send({
        name: 'Featured E2E — Blue vs Red',
        game: 'LoL',
        matchId: featuredMatchId,
        region: 'EUW',
        outcomes: [
          { label: 'Victoire Blue side', side: 'HOME' },
          { label: 'Victoire Red side', side: 'AWAY' },
        ],
      })
      .expect(201);
    const marketId = featured.body.marketId as string;
    const homeOutcomeId = featured.body.mapping.HOME as string;
    expect(homeOutcomeId).toBe(featured.body.outcomes[0]);

    // le marché créé est visible publiquement et le match apparaît dans la liste featured
    const markets = await request(server()).get('/markets').expect(200);
    expect(markets.body.some((m: { id: string }) => m.id === marketId)).toBe(true);
    const featuredList = await request(server()).get('/game-integration/featured').expect(200);
    expect(
      featuredList.body.some(
        (f: { matchId: string; marketId: string }) =>
          f.matchId === featuredMatchId && f.marketId === marketId,
      ),
    ).toBe(true);

    // le joueur parie sur l'issue HOME (StubRiotClient fait gagner team 100 → HOME)
    const placed = await request(server())
      .post('/bets')
      .set(...bearer(playerTok))
      .set('Idempotency-Key', 'featured-bet-1')
      .send({ outcomeId: homeOutcomeId, stake: 15 })
      .expect(201);
    const betId = placed.body.betId as string;

    // When — synchronisation du résultat (match terminé)
    const sync = await request(server())
      .post(`/game-integration/matches/${featuredMatchId}/sync`)
      .set(...bearer(managerTok))
      .expect(200);

    // Then — pari gagnant réglé exactement une fois
    expect(sync.body).toMatchObject({ status: 'SETTLED', resolution: 'WON_OUTCOME' });
    expect(sync.body.winningOutcomeId).toBe(homeOutcomeId);
    expect(sync.body.summary.won).toBeGreaterThanOrEqual(1);

    const bet = await request(server())
      .get(`/bets/${betId}`)
      .set(...bearer(playerTok))
      .expect(200);
    expect(bet.body.status).toBe('WON');

    const resync = await request(server())
      .post(`/game-integration/matches/${featuredMatchId}/sync`)
      .set(...bearer(managerTok))
      .expect(200);
    expect(resync.body.summary).toMatchObject({ settled: 0, won: 0 });
  });

  it('shouldExposeFeaturedListPubliclyButGuardFeatureCreation_WhenAccessControlChecked', async () => {
    // GET featured est PUBLIC (pas de token)
    await request(server()).get('/game-integration/featured').expect(200);
    // POST featured est réservé au MANAGER
    await request(server())
      .post('/game-integration/featured')
      .send({ name: 'x', game: 'LoL', matchId: 'EUW1_X', outcomes: [] })
      .expect(401);
    await request(server())
      .post('/game-integration/featured')
      .set(...bearer(playerTok))
      .send({ name: 'x', game: 'LoL', matchId: 'EUW1_X', outcomes: [] })
      .expect(403);
  });
});
