/* eslint-disable */
// Test d'ATOMICITÉ sur un VRAI Postgres (embedded-postgres, sans Docker). Prouve le « zéro perte »
// du défi 3 : un échec en milieu de transaction roule TOUT en arrière. Lancer : npm run test:atomicity:pg
require('reflect-metadata');
const assert = require('node:assert');
const { rmSync } = require('node:fs');
const { DataSource } = require('typeorm');
const { TransactionContext } = require('../dist/persistence/TransactionContext.js');
const { TypeOrmBetRepository } = require('../dist/contexts/betting/infrastructure/persistence/TypeOrmBetRepository.js');
const { TypeOrmUnitOfWork } = require('../dist/contexts/betting/infrastructure/persistence/TypeOrmUnitOfWork.js');
const { TypeOrmWalletDebitAdapter } = require('../dist/contexts/wallet/infrastructure/persistence/TypeOrmWalletDebitAdapter.js');
const { BetRecord } = require('../dist/contexts/betting/infrastructure/persistence/BetRecord.js');
const { BetEventRecord } = require('../dist/contexts/betting/infrastructure/persistence/BetEventRecord.js');
const { OutboxRecord } = require('../dist/contexts/betting/infrastructure/persistence/OutboxRecord.js');
const { ProcessedMessageRecord } = require('../dist/messaging/ProcessedMessageRecord.js');
const { IdempotentMessageHandler } = require('../dist/messaging/IdempotentMessageHandler.js');
const { WalletRecord } = require('../dist/contexts/wallet/infrastructure/persistence/WalletRecord.js');
const { InitBetting1718200000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting.js');
const { InitWallet1718300000000 } = require('../dist/contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet.js');
const { InitOutbox1718400000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox.js');
const { InitProcessedMessages1718500000000 } = require('../dist/messaging/migrations/1718500000000-InitProcessedMessages.js');
const { PlaceBet } = require('../dist/contexts/betting/application/PlaceBet.js');
const { Bet } = require('../dist/contexts/betting/domain/Bet.js');
const { Odds } = require('../dist/shared-kernel/domain/Odds.js');

const DATA_DIR = '/tmp/pgdata_betnext_check';
const PORT = 55434;

(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: 'betnext', password: 'betnext', port: PORT, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('betnext');

  const ds = new DataSource({
    type: 'postgres', host: '127.0.0.1', port: PORT, username: 'betnext', password: 'betnext', database: 'betnext',
    entities: [BetRecord, BetEventRecord, WalletRecord, OutboxRecord, ProcessedMessageRecord],
    migrations: [InitBetting1718200000000, InitWallet1718300000000, InitOutbox1718400000000, InitProcessedMessages1718500000000],
  });
  await ds.initialize();
  await ds.runMigrations(); // joue le VRAI schéma (incl. trigger append-only)

  const ctx = new TransactionContext();
  const bets = new TypeOrmBetRepository(ds, ctx);
  const wallet = new TypeOrmWalletDebitAdapter(ctx);
  const uow = new TypeOrmUnitOfWork(ds, ctx);
  const odds = { currentOdds: async () => Odds.of(2) };
  let n = 0; const ids = { next: () => `bet-${++n}` };
  const reset = async () => { await ds.query('TRUNCATE "bets", "bet_events", "outbox", "processed_messages" RESTART IDENTITY'); await ds.getRepository(WalletRecord).save({ userId: 'u1', balance: 100 }); };

  // 1) chemin nominal
  await reset();
  const out = await new PlaceBet(bets, odds, wallet, ids, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 20 });
  let w = await ds.getRepository(WalletRecord).findOneOrFail({ where: { userId: 'u1' } });
  assert.strictEqual(Number(w.balance), 80);
  assert.ok(await bets.findById(out.betId));
  assert.strictEqual((await bets.history(out.betId)).length, 1);
  console.log('✓ nominal : debit + pari + event committes ensemble (solde 80)');

  // 2) echec en milieu de transaction -> rollback total
  await reset();
  const bet = Bet.place({ id: 'rb', userId: 'u1', outcomeId: 'o1', stake: 30, currentOdds: Odds.of(2) });
  let threw = false;
  try { await uow.withTransaction(async () => { await wallet.debit('u1', 30, 'k'); await bets.save(bet); throw new Error('boom'); }); } catch (e) { threw = e.message === 'boom'; }
  assert.ok(threw);
  w = await ds.getRepository(WalletRecord).findOneOrFail({ where: { userId: 'u1' } });
  assert.strictEqual(Number(w.balance), 100);
  assert.strictEqual(await bets.findById('rb'), null);
  assert.strictEqual((await bets.history('rb')).length, 0);
  console.log('✓ rollback : echec en milieu de tx -> solde INCHANGE (100), 0 pari, 0 event');

  // 3) echec du save pari via PlaceBet -> debit annule
  await reset();
  const failing = { save: async () => { throw new Error('save KO'); }, findById: async () => null, history: async () => [] };
  let threw2 = false;
  try { await new PlaceBet(failing, odds, wallet, ids, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 40 }); } catch (e) { threw2 = e.message === 'save KO'; }
  assert.ok(threw2);
  w = await ds.getRepository(WalletRecord).findOneOrFail({ where: { userId: 'u1' } });
  assert.strictEqual(Number(w.balance), 100);
  console.log('✓ echec save pari -> debit annule (jamais de debit sans pari, solde 100)');

  // 4) concurrence : deux debits paralleles de 60 sur un solde de 100 -> un seul passe (pas de lost update)
  await reset();
  const pbC = new PlaceBet(bets, odds, wallet, ids, uow);
  const results = await Promise.allSettled([
    pbC.execute({ userId: 'u1', outcomeId: 'o1', stake: 60 }),
    pbC.execute({ userId: 'u1', outcomeId: 'o1', stake: 60 }),
  ]);
  const okCount = results.filter((r) => r.status === 'fulfilled').length;
  const koCount = results.filter((r) => r.status === 'rejected').length;
  assert.strictEqual(okCount, 1);
  assert.strictEqual(koCount, 1);
  w = await ds.getRepository(WalletRecord).findOneOrFail({ where: { userId: 'u1' } });
  assert.strictEqual(Number(w.balance), 40);
  console.log('\u2713 concurrence : 2 debits //, 1 seul passe, solde 40 (zero lost update)');

  // 5) append-only AU NIVEAU BASE : UPDATE/DELETE d'un event rejete par le trigger (BET-6, sur PG reel)
  await reset();
  await new PlaceBet(bets, odds, wallet, ids, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 10 });
  let updBlocked = false;
  try { await ds.query("UPDATE bet_events SET type = 'TAMPERED'"); } catch (e) { updBlocked = /append-only/.test(e.message); }
  assert.ok(updBlocked, 'UPDATE bet_events doit etre rejete par le trigger');
  let delBlocked = false;
  try { await ds.query('DELETE FROM bet_events'); } catch (e) { delBlocked = /append-only/.test(e.message); }
  assert.ok(delBlocked, 'DELETE bet_events doit etre rejete par le trigger');
  console.log('\u2713 append-only DB : UPDATE/DELETE d un event rejetes par le trigger (BET-6)');

  // 6) OUTBOX dans la MEME transaction : commit -> 1 ligne ; rollback -> 0 ligne (BET-7)
  await reset();
  await new PlaceBet(bets, odds, wallet, ids, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 10 });
  let pubCount = await ds.query('SELECT count(*)::int AS c FROM outbox');
  assert.strictEqual(pubCount[0].c, 1);
  const betOb = Bet.place({ id: 'ob-rb', userId: 'u1', outcomeId: 'o1', stake: 10, currentOdds: Odds.of(2) });
  let obThrew = false;
  try { await uow.withTransaction(async () => { await wallet.debit('u1', 10, 'k'); await bets.save(betOb); throw new Error('boom'); }); } catch (e) { obThrew = e.message === 'boom'; }
  assert.ok(obThrew);
  const obRb = await ds.query("SELECT count(*)::int AS c FROM outbox WHERE payload LIKE '%ob-rb%'");
  assert.strictEqual(obRb[0].c, 0);
  console.log('\u2713 outbox : ecrit dans la meme tx (commit=1, rollback=0) — fenetre de perte fermee');

  // 7) IDEMPOTENCE consommateur : double-livraison du meme message -> effet applique UNE fois (BET-7)
  await reset();
  const idem = new IdempotentMessageHandler(ds);
  const mid = require('node:crypto').randomUUID();
  let applied = 0;
  await idem.handle(mid, async () => { applied += 1; });
  await idem.handle(mid, async () => { applied += 1; });
  assert.strictEqual(applied, 1);
  const pc = await ds.query('SELECT count(*)::int AS c FROM processed_messages WHERE "messageId" = $1', [mid]);
  assert.strictEqual(pc[0].c, 1);
  console.log('\u2713 idempotence consommateur : double-livraison -> effet 1 fois (processed_messages=1)');

  // 8) idempotence CONCURRENTE : 2 livraisons // du meme message -> effet DB applique UNE fois (PK)
  await reset();
  await ds.query('DROP TABLE IF EXISTS _idemtest; CREATE TABLE _idemtest (n serial PRIMARY KEY)');
  const idem2 = new IdempotentMessageHandler(ds);
  const mid2 = require('node:crypto').randomUUID();
  const dbEffect = async (m) => { await m.query('INSERT INTO _idemtest DEFAULT VALUES'); };
  await Promise.allSettled([idem2.handle(mid2, dbEffect), idem2.handle(mid2, dbEffect)]);
  const effc = await ds.query('SELECT count(*)::int AS c FROM _idemtest');
  const pmc = await ds.query('SELECT count(*)::int AS c FROM processed_messages WHERE "messageId" = $1', [mid2]);
  assert.strictEqual(effc[0].c, 1);
  assert.strictEqual(pmc[0].c, 1);
  console.log('\u2713 idempotence CONCURRENTE : 2 livraisons // -> effet DB 1 fois (PK garde-fou)');

  await ds.destroy();
  await pg.stop();
  console.log('\nATOMICITE PG REELLE : OK — zero perte demontree (defi 3).');
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
