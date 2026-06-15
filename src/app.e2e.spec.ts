import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';

/**
 * Test e2e (mode en mémoire, sans DB). Vérifie le câblage HTTP→CQRS→use case + l'idempotence HTTP
 * (la concurrence réelle est prouvée sur Postgres dans le script atomicity-pg).
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

  it('GET /health → 200', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /bets sans Idempotency-Key → 400', async () => {
    await request(app.getHttpServer())
      .post('/bets')
      .send({ userId: 'u1', outcomeId: 'o1', stake: 10 })
      .expect(400);
  });

  it('POST /bets (valide, avec clé) → 201 + cote figée', async () => {
    const res = await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'k-201')
      .send({ userId: 'u1', outcomeId: 'o1', stake: 20 })
      .expect(201);
    expect(res.body).toMatchObject({ lockedOdds: 2, potentialGain: 40 });
    expect(typeof res.body.betId).toBe('string');
  });

  it('POST /bets (forme invalide, avec clé) → 400', async () => {
    await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'k-bad')
      .send({ userId: 'u1' })
      .expect(400);
  });

  it('POST /bets (mise <= 0, invariant métier) → 422', async () => {
    await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'k-neg')
      .send({ userId: 'u1', outcomeId: 'o1', stake: -5 })
      .expect(422);
  });

  it('idempotence : même clé + même corps → même betId (rejoué, pas de 2e pari)', async () => {
    const body = { userId: 'u9', outcomeId: 'o1', stake: 15 };
    const r1 = await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'idem-1')
      .send(body)
      .expect(201);
    const r2 = await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'idem-1')
      .send(body)
      .expect(201);
    expect(r2.body.betId).toBe(r1.body.betId);
  });

  it('idempotence : même clé + corps différent → 409', async () => {
    await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'idem-2')
      .send({ userId: 'u1', outcomeId: 'o1', stake: 10 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'idem-2')
      .send({ userId: 'u1', outcomeId: 'o1', stake: 99 })
      .expect(409);
  });
});
