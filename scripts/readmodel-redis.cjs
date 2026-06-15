/* eslint-disable */
// E2E BET-10 sur VRAI Redis : OddsUpdated (file odds) -> OddsProjectorService (worker câblé au
// boot) -> RedisOddsReadModel (hash) -> lecture servie depuis Redis (jamais la base d'écriture).
// Vérifie aussi le COLD CACHE (null avant toute projection). SKIP sans REDIS_URL. Tourne en CI.
// Lancer : npm run test:readmodel:redis
require('reflect-metadata');
const assert = require('node:assert');
const { randomUUID } = require('node:crypto');
const { Queue } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.log('SKIP readmodel-redis : pas de REDIS_URL (ce test tourne en CI / `docker compose up -d redis`).');
  process.exit(0);
}
const IORedis = require('ioredis');
const RedisClient = IORedis.Redis || IORedis;

const d = (m) => require('../dist/' + m);
const { OddsProjectorService } = d('read-model/OddsProjectorService.js');
const { RedisOddsReadModel } = d('read-model/RedisOddsReadModel.js');
const { BullMqQueueAdapter } = d('messaging/BullMqQueueAdapter.js');
const { ODDS_QUEUE } = d('messaging/topics.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await cond()) return; await sleep(150); }
  throw new Error('timeout waitFor');
}

(async () => {
  const redis = new RedisClient(REDIS_URL);
  await redis.del('readmodel:odds');
  const u = new URL(REDIS_URL);
  const oddsQueue = new Queue(ODDS_QUEUE, { connection: { host: u.hostname, port: Number(u.port || 6379) } });
  try { await oddsQueue.obliterate({ force: true }); } catch (_) {}

  const readModel = new RedisOddsReadModel(redis);
  assert.strictEqual(await readModel.current('o1'), null, 'cold cache : null avant toute projection');
  console.log('✓ cold cache : aucune cote avant OddsUpdated (cohérence éventuelle observable)');

  // Projecteur câblé au boot : consomme OddsUpdated -> read-model Redis
  const projector = new OddsProjectorService(readModel);
  projector.onApplicationBootstrap();

  // Pricing publie OddsUpdated sur le bus
  await new BullMqQueueAdapter(oddsQueue).enqueue({
    id: randomUUID(),
    type: 'OddsUpdated',
    payload: JSON.stringify({ type: 'OddsUpdated', updates: [{ outcomeId: 'o1', odds: 3.5 }] }),
  });

  await waitFor(async () => (await readModel.current('o1')) === 3.5, 12000);
  assert.strictEqual(await readModel.current('o1'), 3.5, 'cote lue depuis le read-model Redis');
  console.log('✓ OddsUpdated -> projecteur -> read-model Redis -> lecture = 3.5 (servie depuis Redis)');

  // out-of-order : un snapshot plus ANCIEN arrivé après ne doit pas écraser le plus récent
  const tNew = Date.now();
  const adapter = new BullMqQueueAdapter(oddsQueue);
  await adapter.enqueue({ id: randomUUID(), type: 'OddsUpdated', payload: JSON.stringify({ type: 'OddsUpdated', occurredAt: new Date(tNew).toISOString(), updates: [{ outcomeId: 'o2', odds: 4 }] }) });
  await adapter.enqueue({ id: randomUUID(), type: 'OddsUpdated', payload: JSON.stringify({ type: 'OddsUpdated', occurredAt: new Date(tNew - 10000).toISOString(), updates: [{ outcomeId: 'o2', odds: 9 }] }) });
  await waitFor(async () => (await readModel.current('o2')) === 4, 12000);
  await sleep(800); // laisser le snapshot ancien être traité (et rejeté)
  assert.strictEqual(await readModel.current('o2'), 4, 'snapshot plus ancien ignoré (garde monotone)');
  console.log('\u2713 out-of-order : snapshot plus ancien ignore -> cote pas durablement fausse');

  await projector.onModuleDestroy();
  await oddsQueue.close();
  redis.disconnect();
  console.log('\nREAD-MODEL -> REDIS E2E : OK (lecture hors base d ecriture, cold cache propre).');
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
