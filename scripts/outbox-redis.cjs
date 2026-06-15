/* eslint-disable */
// E2E : outbox -> BullMQ -> consommateur sur un VRAI Redis. Postgres = embedded-postgres (in-process).
// Tourne en CI (service redis) et en local (`docker compose up -d redis`). Sans REDIS_URL -> SKIP
// (mon bac à sable ne peut pas télécharger un binaire Redis). Lancer : npm run test:outbox:redis
require('reflect-metadata');
const assert = require('node:assert');
const { rmSync } = require('node:fs');
const { DataSource } = require('typeorm');
const { Queue } = require('bullmq');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.log('SKIP outbox-redis : pas de REDIS_URL (ce test tourne en CI / `docker compose up -d redis`).');
  process.exit(0);
}

const d = (m) => require('../dist/' + m);
const { TransactionContext } = d('persistence/TransactionContext.js');
const { TypeOrmBetRepository } = d('contexts/betting/infrastructure/persistence/TypeOrmBetRepository.js');
const { TypeOrmUnitOfWork } = d('contexts/betting/infrastructure/persistence/TypeOrmUnitOfWork.js');
const { TypeOrmWalletDebitAdapter } = d('contexts/wallet/infrastructure/persistence/TypeOrmWalletDebitAdapter.js');
const { BetRecord } = d('contexts/betting/infrastructure/persistence/BetRecord.js');
const { BetEventRecord } = d('contexts/betting/infrastructure/persistence/BetEventRecord.js');
const { OutboxRecord } = d('contexts/betting/infrastructure/persistence/OutboxRecord.js');
const { WalletRecord } = d('contexts/wallet/infrastructure/persistence/WalletRecord.js');
const { ProcessedMessageRecord } = d('messaging/ProcessedMessageRecord.js');
const { InitBetting1718200000000 } = d('contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting.js');
const { InitWallet1718300000000 } = d('contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet.js');
const { InitOutbox1718400000000 } = d('contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox.js');
const { InitProcessedMessages1718500000000 } = d('messaging/migrations/1718500000000-InitProcessedMessages.js');
const { PlaceBet } = d('contexts/betting/application/PlaceBet.js');
const { Odds } = d('shared-kernel/domain/Odds.js');
const { OutboxRelay } = d('messaging/OutboxRelay.js');
const { BullMqQueueAdapter } = d('messaging/BullMqQueueAdapter.js');
const { IdempotentMessageHandler } = d('messaging/IdempotentMessageHandler.js');
const { OutboxConsumer } = d('messaging/OutboxConsumer.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await cond()) return; await sleep(200); }
  throw new Error('timeout waitFor');
}

(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const DATA_DIR = '/tmp/pgdata_outbox'; const PGPORT = 55435;
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: 'betnext', password: 'betnext', port: PGPORT, persistent: false });
  await pg.initialise(); await pg.start(); await pg.createDatabase('betnext');
  const ds = new DataSource({
    type: 'postgres', host: '127.0.0.1', port: PGPORT, username: 'betnext', password: 'betnext', database: 'betnext',
    entities: [BetRecord, BetEventRecord, WalletRecord, OutboxRecord, ProcessedMessageRecord],
    migrations: [InitBetting1718200000000, InitWallet1718300000000, InitOutbox1718400000000, InitProcessedMessages1718500000000],
  });
  await ds.initialize(); await ds.runMigrations();
  await ds.getRepository(WalletRecord).save({ userId: 'u1', balance: 100 });

  const u = new URL(REDIS_URL);
  const connection = { host: u.hostname, port: Number(u.port || 6379) };
  const queue = new Queue('betnext-outbox', { connection });
  try { await queue.obliterate({ force: true }); } catch (_) {}

  const ctx = new TransactionContext();
  const bets = new TypeOrmBetRepository(ds, ctx);
  const wallet = new TypeOrmWalletDebitAdapter(ctx);
  const uow = new TypeOrmUnitOfWork(ds, ctx);
  const odds = { currentOdds: async () => ({ value: Odds.of(2), provisional: false }) };
  let n = 0; const ids = { next: () => `bet-${++n}` };

  // 1) pari -> 1 ligne outbox (dans la tx) ; 2) relais -> file BullMQ
  await new PlaceBet(bets, odds, wallet, ids, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 10 });
  const published = await new OutboxRelay(ds, new BullMqQueueAdapter(queue)).publishPending();
  assert.ok(published >= 1, 'relais a publie au moins une ligne');

  // 3) consommateur idempotent traite le job
  const worker = new OutboxConsumer('betnext-outbox', connection, new IdempotentMessageHandler(ds)).start();
  await waitFor(async () => (await ds.query('SELECT count(*)::int AS c FROM processed_messages'))[0].c >= 1, 8000);
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM processed_messages'))[0].c, 1);
  console.log('✓ outbox -> BullMQ -> consommateur : message traite une fois (vrai Redis)');

  // 4) double-livraison du MEME message (meme jobId) -> consommateur idempotent -> toujours 1
  const row = (await ds.query('SELECT id, type, payload FROM outbox LIMIT 1'))[0];
  await new BullMqQueueAdapter(queue).enqueue({ id: row.id, type: row.type, payload: row.payload });
  await sleep(2000);
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM processed_messages'))[0].c, 1);
  console.log('✓ double-livraison at-least-once -> dedupliquee (processed_messages=1)');

  await worker.close(); await queue.close(); await ds.destroy(); await pg.stop();
  console.log('\nOUTBOX -> REDIS E2E : OK (at-least-once + consommateur idempotent).');
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
