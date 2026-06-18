/* eslint-disable */
require('reflect-metadata');
const assert = require('node:assert');
const { randomUUID } = require('node:crypto');
const { rmSync } = require('node:fs');
const { DataSource } = require('typeorm');
const { Queue, Worker } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.log('SKIP pricing-redis : pas de REDIS_URL (ce test tourne en CI / `docker compose up -d redis`).');
  process.exit(0);
}
const IORedis = require('ioredis');
const RedisClient = IORedis.Redis || IORedis;

const d = (m) => require('../dist/' + m);
const { OutboxRecord } = d('contexts/betting/infrastructure/persistence/OutboxRecord.js');
const { BetRecord } = d('contexts/betting/infrastructure/persistence/BetRecord.js');
const { BetEventRecord } = d('contexts/betting/infrastructure/persistence/BetEventRecord.js');
const { WalletRecord } = d('contexts/wallet/infrastructure/persistence/WalletRecord.js');
const { ProcessedMessageRecord } = d('messaging/ProcessedMessageRecord.js');
const { InitBetting1718200000000 } = d('contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting.js');
const { InitWallet1718300000000 } = d('contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet.js');
const { InitOutbox1718400000000 } = d('contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox.js');
const { InitProcessedMessages1718500000000 } = d('messaging/migrations/1718500000000-InitProcessedMessages.js');
const { OutboxDispatcher } = d('messaging/OutboxDispatcher.js');
const { BullMqQueueAdapter } = d('messaging/BullMqQueueAdapter.js');
const { DOMAIN_EVENTS_QUEUE, ODDS_QUEUE } = d('messaging/topics.js');
const { OddsCalculator } = d('contexts/pricing/domain/OddsCalculator.js');
const { RecalculateOddsOnBetPlaced } = d('contexts/pricing/application/RecalculateOddsOnBetPlaced.js');
const { RegisterMarketOnCreated } = d('contexts/pricing/application/RegisterMarketOnCreated.js');
const { QueueOddsPublisher } = d('contexts/pricing/infrastructure/QueueOddsPublisher.js');
const { RedisPricingStore } = d('contexts/pricing/infrastructure/RedisPricingStore.js');
const { PricingWorker } = d('contexts/pricing/infrastructure/PricingWorker.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await cond()) return; await sleep(150); }
  throw new Error('timeout waitFor');
}
const MARKET_ID = 'mkt-test';
const betPlaced = (outcomeId, stake) => JSON.stringify({ type: 'BetPlaced', outcomeId, stake });
const marketCreated = (marketId, outcomeIds) =>
  JSON.stringify({ type: 'MarketCreated', marketId, outcomeIds });

(async () => {
  process.env.OUTBOX_POLL_MS = '150';
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const DATA_DIR = '/tmp/pgdata_pricing'; const PGPORT = 55436;
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: 'betnext', password: 'betnext', port: PGPORT, persistent: false });
  await pg.initialise(); await pg.start(); await pg.createDatabase('betnext');
  const ds = new DataSource({
    type: 'postgres', host: '127.0.0.1', port: PGPORT, username: 'betnext', password: 'betnext', database: 'betnext',
    entities: [BetRecord, BetEventRecord, WalletRecord, OutboxRecord, ProcessedMessageRecord],
    migrations: [InitBetting1718200000000, InitWallet1718300000000, InitOutbox1718400000000, InitProcessedMessages1718500000000],
  });
  await ds.initialize(); await ds.runMigrations();

  const u = new URL(REDIS_URL);
  const connection = { host: u.hostname, port: Number(u.port || 6379) };
  const redis = new RedisClient(REDIS_URL);
  const stale = await redis.keys('pricing:*');
  if (stale.length > 0) await redis.del(...stale);
  const domain = new Queue(DOMAIN_EVENTS_QUEUE, { connection });
  const odds = new Queue(ODDS_QUEUE, { connection });
  try { await domain.obliterate({ force: true }); await odds.obliterate({ force: true }); } catch (_) {}

  const store = new RedisPricingStore(redis);
  const recalc = new RecalculateOddsOnBetPlaced(
    store, new OddsCalculator(),
    new QueueOddsPublisher(new BullMqQueueAdapter(odds)),
  );
  const registrar = new RegisterMarketOnCreated(store);
  const worker = new PricingWorker(DOMAIN_EVENTS_QUEUE, connection, recalc, registrar).start();
  const received = [];
  const oddsWorker = new Worker(ODDS_QUEUE, async (job) => { received.push(JSON.parse(job.data.payload)); }, { connection });

  const idA = randomUUID(); const idB = randomUUID();
  await ds.getRepository(OutboxRecord).insert([
    { id: randomUUID(), type: 'MarketCreated', payload: marketCreated(MARKET_ID, ['A', 'B', 'C']), createdAt: new Date(Date.now() - 5000) },
    { id: idA, type: 'BetPlaced', payload: betPlaced('A', 10) },
    { id: idB, type: 'BetPlaced', payload: betPlaced('B', 30) },
  ]);

  const dispatcher = new OutboxDispatcher(ds);
  dispatcher.onApplicationBootstrap();

  await waitFor(async () => received.length >= 2, 15000);
  const last = received[received.length - 1].updates;
  const a = last.find((x) => x.outcomeId === 'A');
  const b = last.find((x) => x.outcomeId === 'B');
  const c = last.find((x) => x.outcomeId === 'C');
  assert.ok(a && Math.abs(a.odds - 4) < 0.01, 'OddsUpdated A ~ 4.00 (40/10, pool du marché)');
  assert.ok(b && Math.abs(b.odds - 1.33) < 0.01, 'sœur B recalculée ~ 1.33 (40/30)');
  assert.ok(c && Math.abs(c.odds - 5) < 0.01, 'sœur C non pariée montée à 5.00 (max, plus à l ouverture)');
  const unpublished = (await ds.query('SELECT count(*)::int AS c FROM outbox WHERE "publishedAt" IS NULL'))[0].c;
  assert.strictEqual(unpublished, 0, 'le relais du boot a vidé l outbox');
  console.log('✓ boot réel : MarketCreated -> projection ; BetPlaced -> recalcul de TOUTES les issues du marché (vrai Redis)');

  await new BullMqQueueAdapter(domain).enqueue({ id: idA, type: 'BetPlaced', payload: betPlaced('A', 10) });
  await sleep(1500);
  const totalA = await redis.hget(`pricing:stakes:${MARKET_ID}`, 'A');
  assert.strictEqual(Number(totalA), 10, 'total A inchangé malgré la double-livraison (idempotent)');
  console.log('✓ double-livraison at-least-once -> dedupliquee cote Pricing (total A = 10, pas 20)');

  await dispatcher.onModuleDestroy();
  await worker.close(); await oddsWorker.close(); await domain.close(); await odds.close();
  redis.disconnect(); await ds.destroy(); await pg.stop();
  console.log('\nPRICING -> REDIS E2E : OK (extraction bus-only, relais au boot, recalcul async idempotent).');
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
