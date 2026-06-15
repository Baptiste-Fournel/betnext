import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { ODDS_READ_MODEL, OddsReadModel } from './read-model/OddsReadModel';

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

/**
 * BET-10 — côté LECTURE du CQRS : cote courante servie depuis le read-model (jamais la base
 * d'écriture), read-your-writes joueur, cote figée vs MAJ du read-model, cold cache observable.
 */
describe('BetNext lecture / read-model (e2e, BET-10)', () => {
  let app: INestApplication;
  let readModel: OddsReadModel;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    readModel = app.get<OddsReadModel>(ODDS_READ_MODEL);
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /odds/:id sur read-model FROID → 404 (cohérence éventuelle observable, pas masquée)', async () => {
    await request(app.getHttpServer()).get('/odds/cold-outcome').expect(404);
  });

  it('read-your-writes : le pari posé est lisible immédiatement (GET /bets/:id, store autoritatif)', async () => {
    const post = await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'ryw-1')
      .send({ userId: 'u-ryw', outcomeId: 'o-ryw', stake: 20 })
      .expect(201);
    const betId = post.body.betId as string;
    const get = await request(app.getHttpServer()).get(`/bets/${betId}`).expect(200);
    expect(get.body).toMatchObject({ betId, status: 'PENDING', stake: 20, lockedOdds: 2 });
    expect(post.body.pricingProvisional).toBe(true); // read-model froid → cote provisoire, observable
  });

  it('cote FIGÉE : une MAJ du read-model ne change pas un pari déjà posé ; un nouveau pari prend la cote courante', async () => {
    const first = await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'frz-1')
      .send({ userId: 'u-frz', outcomeId: 'o-frz', stake: 10 })
      .expect(201);
    expect(first.body.lockedOdds).toBe(2); // read-model froid → cote d'ouverture, figée à la pose
    expect(first.body.pricingProvisional).toBe(true); // cold → provisoire (cohérence éventuelle visible)

    // OddsUpdated projeté dans le read-model (simule la boucle Pricing → projection)
    await readModel.put([{ outcomeId: 'o-frz', odds: 4 }], Date.now());

    // la cote COURANTE bouge (servie depuis le read-model, pas la base d'écriture)
    const odds = await request(app.getHttpServer()).get('/odds/o-frz').expect(200);
    expect(odds.body).toMatchObject({ outcomeId: 'o-frz', odds: 4 });

    // le pari DÉJÀ posé garde sa cote figée (2), inchangée par la MAJ du read-model
    const reread = await request(app.getHttpServer()).get(`/bets/${first.body.betId}`).expect(200);
    expect(reread.body.lockedOdds).toBe(2);

    // un NOUVEAU pari fige la cote courante (4) → la boucle async est bien refermée
    const second = await request(app.getHttpServer())
      .post('/bets')
      .set('Idempotency-Key', 'frz-2')
      .send({ userId: 'u-frz', outcomeId: 'o-frz', stake: 10 })
      .expect(201);
    expect(second.body.lockedOdds).toBe(4);
    expect(second.body.pricingProvisional).toBe(false); // read-model chaud → cote Pricing, non provisoire
  });
});
