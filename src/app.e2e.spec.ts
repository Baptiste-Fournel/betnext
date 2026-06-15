import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';

/**
 * Test e2e de la tranche BET-11 : exerce réellement HTTP → CommandBus → handler → use case.
 * C'est le test qui valide le câblage CQRS/DI (et non le seul use case isolé).
 */
describe('BetNext API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 (status ok)', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('betnext');
  });

  it('POST /bets (valide) → 201 avec cote figée + gain potentiel', async () => {
    const res = await request(app.getHttpServer())
      .post('/bets')
      .send({ userId: 'u1', outcomeId: 'o1', stake: 20 })
      .expect(201);
    expect(res.body).toMatchObject({ lockedOdds: 2, potentialGain: 40 });
    expect(typeof res.body.betId).toBe('string');
  });

  it('POST /bets (forme invalide) → 400', async () => {
    await request(app.getHttpServer()).post('/bets').send({ userId: 'u1' }).expect(400);
  });

  it('POST /bets (mise <= 0, invariant métier) → 422', async () => {
    await request(app.getHttpServer())
      .post('/bets')
      .send({ userId: 'u1', outcomeId: 'o1', stake: -5 })
      .expect(422);
  });
});
