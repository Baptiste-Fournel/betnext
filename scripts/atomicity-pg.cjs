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
const { IdempotencyKeyRecord } = require('../dist/contexts/betting/infrastructure/persistence/IdempotencyKeyRecord.js');
const { TypeOrmIdempotencyStore } = require('../dist/contexts/betting/infrastructure/persistence/TypeOrmIdempotencyStore.js');
const { IdempotentPlaceBet } = require('../dist/contexts/betting/application/IdempotentPlaceBet.js');
const { IdempotencyConflictError } = require('../dist/shared-kernel/domain/IdempotencyConflictError.js');
const { InitIdempotencyKeys1718600000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718600000000-InitIdempotencyKeys.js');
const { createHash } = require('node:crypto');
const { WalletRecord } = require('../dist/contexts/wallet/infrastructure/persistence/WalletRecord.js');
const { InitBetting1718200000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting.js');
const { InitWallet1718300000000 } = require('../dist/contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet.js');
const { InitOutbox1718400000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox.js');
const { InitProcessedMessages1718500000000 } = require('../dist/messaging/migrations/1718500000000-InitProcessedMessages.js');
const { PlaceBet } = require('../dist/contexts/betting/application/PlaceBet.js');
const { Bet } = require('../dist/contexts/betting/domain/Bet.js');
const { Odds } = require('../dist/shared-kernel/domain/Odds.js');
const { SettleMarket } = require('../dist/contexts/betting/application/SettleMarket.js');
const { SettlementStrategyFactory } = require('../dist/contexts/betting/application/SettlementStrategyFactory.js');
const { TypeOrmWalletCreditAdapter } = require('../dist/contexts/wallet/infrastructure/persistence/TypeOrmWalletCreditAdapter.js');
const { WalletOperationRecord } = require('../dist/contexts/wallet/infrastructure/persistence/WalletOperationRecord.js');
const { InitWalletOperations1718700000000 } = require('../dist/contexts/wallet/infrastructure/persistence/migrations/1718700000000-InitWalletOperations.js');
const { InitBetSettlementGuard1718800000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718800000000-InitBetSettlementGuard.js');
const { TypeOrmComplianceStore } = require('../dist/contexts/compliance/infrastructure/TypeOrmComplianceStore.js');
const { ReserveStake } = require('../dist/contexts/compliance/application/ReserveStake.js');
const { CompliancePolicyRegistry } = require('../dist/contexts/compliance/application/CompliancePolicyRegistry.js');
const { DailyCapPolicy } = require('../dist/contexts/compliance/domain/DailyCapPolicy.js');
const { InitCompliance1718900000000 } = require('../dist/contexts/compliance/infrastructure/persistence/migrations/1718900000000-InitCompliance.js');

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
    entities: [BetRecord, BetEventRecord, WalletRecord, WalletOperationRecord, OutboxRecord, ProcessedMessageRecord, IdempotencyKeyRecord],
    migrations: [InitBetting1718200000000, InitWallet1718300000000, InitOutbox1718400000000, InitProcessedMessages1718500000000, InitIdempotencyKeys1718600000000, InitWalletOperations1718700000000, InitBetSettlementGuard1718800000000, InitCompliance1718900000000],
  });
  await ds.initialize();
  await ds.runMigrations(); // joue le VRAI schéma (incl. trigger append-only)

  const ctx = new TransactionContext();
  const bets = new TypeOrmBetRepository(ds, ctx);
  const wallet = new TypeOrmWalletDebitAdapter(ctx);
  const uow = new TypeOrmUnitOfWork(ds, ctx);
  const odds = { currentOdds: async () => ({ value: Odds.of(2), provisional: false }) };
  let n = 0; const ids = { next: () => `bet-${++n}` };
  const reset = async () => { await ds.query('TRUNCATE "bets", "bet_events", "outbox", "processed_messages", "idempotency_keys", "wallet_operations", "rg_caps", "rg_daily_stakes" RESTART IDENTITY'); await ds.getRepository(WalletRecord).save({ userId: 'u1', balance: 100 }); };

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

  // 9/10/11) IDEMPOTENCE HTTP (Idempotency-Key) sur vrai Postgres
  const hashOf = (i) => createHash('sha256').update(JSON.stringify({ userId: i.userId, outcomeId: i.outcomeId, stake: i.stake })).digest('hex');
  const idemPlaceBet = new IdempotentPlaceBet(
    new PlaceBet(bets, odds, wallet, ids, uow),
    new TypeOrmIdempotencyStore(ds, ctx),
    uow,
  );
  const balance = async () => Number((await ds.getRepository(WalletRecord).findOneOrFail({ where: { userId: 'u1' } })).balance);
  const betCount = async () => (await ds.query('SELECT count(*)::int AS c FROM bets'))[0].c;

  // 9) même clé + même corps, séquentiel -> 1 pari / 1 débit / même betId
  await reset();
  const inp = { userId: 'u1', outcomeId: 'o1', stake: 20 };
  const o1 = await idemPlaceBet.execute({ ...inp, idempotencyKey: 'idem-seq', requestHash: hashOf(inp) });
  const o2 = await idemPlaceBet.execute({ ...inp, idempotencyKey: 'idem-seq', requestHash: hashOf(inp) });
  assert.strictEqual(o1.betId, o2.betId);
  assert.strictEqual(await betCount(), 1);
  assert.strictEqual(await balance(), 80);
  console.log('\u2713 idempotence HTTP : retry meme cle (ex. reponse perdue) -> 1 pari / 1 debit (meme betId)');

  // 10) même clé en CONCURRENCE -> 1 seul pari / 1 débit
  await reset();
  const cr = await Promise.allSettled([
    idemPlaceBet.execute({ ...inp, idempotencyKey: 'idem-conc', requestHash: hashOf(inp) }),
    idemPlaceBet.execute({ ...inp, idempotencyKey: 'idem-conc', requestHash: hashOf(inp) }),
  ]);
  const ok = cr.filter((r) => r.status === 'fulfilled');
  assert.strictEqual(ok.length, 2);
  assert.strictEqual(ok[0].value.betId, ok[1].value.betId);
  assert.strictEqual(await betCount(), 1);
  assert.strictEqual(await balance(), 80);
  console.log('\u2713 idempotence HTTP CONCURRENTE : meme cle // -> 1 pari / 1 debit');

  // 11) même clé + corps DIFFÉRENT -> conflit (409), aucun 2e pari
  await reset();
  const a = { userId: 'u1', outcomeId: 'o1', stake: 10 };
  const b = { userId: 'u1', outcomeId: 'o1', stake: 99 };
  await idemPlaceBet.execute({ ...a, idempotencyKey: 'idem-cflt', requestHash: hashOf(a) });
  let conflict = false;
  try { await idemPlaceBet.execute({ ...b, idempotencyKey: 'idem-cflt', requestHash: hashOf(b) }); }
  catch (e) { conflict = e instanceof IdempotencyConflictError; }
  assert.ok(conflict);
  assert.strictEqual(await betCount(), 1);
  console.log('\u2713 idempotence HTTP : meme cle + corps different -> conflit (aucun 2e pari)');

  // 12) retry d'une tentative ÉCHOUÉE (solde insuffisant) avec la MÊME clé -> clé NON brûlée
  await reset();
  await ds.getRepository(WalletRecord).update({ userId: 'u1' }, { balance: '5' }); // < mise 10
  const fInp = { userId: 'u1', outcomeId: 'o1', stake: 10 };
  let failed = false;
  try { await idemPlaceBet.execute({ ...fInp, idempotencyKey: 'idem-retry', requestHash: hashOf(fInp) }); }
  catch { failed = true; }
  assert.ok(failed); // échoue (solde insuffisant)
  const keyRows = await ds.query('SELECT count(*)::int AS c FROM idempotency_keys WHERE "key" = $1', ['idem-retry']);
  assert.strictEqual(keyRows[0].c, 0); // clé rollback -> NON brûlée
  await ds.getRepository(WalletRecord).update({ userId: 'u1' }, { balance: '100' }); // recharge
  const ok12 = await idemPlaceBet.execute({ ...fInp, idempotencyKey: 'idem-retry', requestHash: hashOf(fInp) });
  assert.ok(ok12.betId);
  assert.strictEqual(await betCount(), 1); // retry corrigé crée le pari
  console.log('\u2713 idempotence HTTP : retry apres echec (meme cle) -> cle non brulee, pari cree');

  // 13/14/15) SETTLEMENT (BET-12) sur vrai Postgres
  const credit = new TypeOrmWalletCreditAdapter(ctx);
  const settle = new SettleMarket(bets, credit, new SettlementStrategyFactory(), uow);
  const balanceOf = async (u) => Number((await ds.getRepository(WalletRecord).findOneOrFail({ where: { userId: u } })).balance);
  const betStatusOf = async (id) => (await ds.query('SELECT status FROM bets WHERE id = $1', [id]))[0].status;

  // 13) WON : credit a la cote figee, EXACTEMENT-UNE-FOIS (rejeu = meme solde) + event BetWon journalise
  await reset();
  await new PlaceBet(bets, odds, wallet, { next: () => 'sb1' }, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 20 });
  let sr = await settle.execute({ outcomes: ['o1'], winningOutcomeId: 'o1', voided: false });
  assert.strictEqual(sr.won, 1);
  assert.strictEqual(await balanceOf('u1'), 120); // 100 - 20 (mise) + 40 (gain cote figee 2.0)
  assert.strictEqual(await betStatusOf('sb1'), 'WON');
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM bet_events WHERE "betId"=$1 AND type=$2', ['sb1', 'BetWon']))[0].c, 1);
  await settle.execute({ outcomes: ['o1'], winningOutcomeId: 'o1', voided: false }); // rejeu
  assert.strictEqual(await balanceOf('u1'), 120); // INCHANGE -> exactement-une-fois
  assert.strictEqual((await ds.query("SELECT count(*)::int AS c FROM outbox WHERE type='BetWon'"))[0].c, 1); // 1 event publie
  console.log('\u2713 settlement WON : credit exactement-une-fois (rejeu = solde 120), event BetWon journalise');

  // 14) VOID : remboursement EXACT de la mise (rejeu = meme solde)
  await reset();
  await new PlaceBet(bets, odds, wallet, { next: () => 'sb2' }, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 20 });
  await settle.execute({ outcomes: ['o1'], winningOutcomeId: null, voided: true });
  assert.strictEqual(await balanceOf('u1'), 100); // mise remboursee a l'identique
  await settle.execute({ outcomes: ['o1'], winningOutcomeId: null, voided: true }); // rejeu
  assert.strictEqual(await balanceOf('u1'), 100);
  console.log('\u2713 settlement VOID : remboursement EXACT de la mise (rejeu = solde 100)');

  // 15) ATOMIQUE par pari + RESILIENT : un credit en echec rollback CE pari, les autres sont regles
  await reset();
  await ds.getRepository(WalletRecord).save({ userId: 'u2', balance: 100 });
  await new PlaceBet(bets, odds, wallet, { next: () => 'ok1' }, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 20 });
  await new PlaceBet(bets, odds, wallet, { next: () => 'boom1' }, uow).execute({ userId: 'u2', outcomeId: 'o1', stake: 20 });
  const failingCredit = { credit: async (u, a, k) => { if (u === 'u2') throw new Error('credit boom'); return credit.credit(u, a, k); } };
  sr = await new SettleMarket(bets, failingCredit, new SettlementStrategyFactory(), uow).execute({ outcomes: ['o1'], winningOutcomeId: 'o1', voided: false });
  assert.strictEqual(sr.settled, 1);
  assert.strictEqual(sr.failed, 1);
  assert.strictEqual(await betStatusOf('ok1'), 'WON');
  assert.strictEqual(await betStatusOf('boom1'), 'PENDING'); // pari en echec : rollback complet -> toujours en attente
  assert.strictEqual(await balanceOf('u1'), 120); // gagnant credite
  assert.strictEqual(await balanceOf('u2'), 80); // PAS credite (rollback) -> aucun mouvement errone
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM wallet_operations WHERE "opKey"=$1', ['payout:boom1']))[0].c, 0);
  assert.strictEqual((await ds.query("SELECT count(*)::int AS c FROM outbox WHERE type='BetWon'"))[0].c, 1); // seul ok1 a publie (boom1 rollback)
  console.log('\u2713 settlement atomique+resilient : pari en echec rollback (PENDING, non credite), les autres regles');

  // 16) règlement CONCURRENT du même marché -> 1 SEUL event BetWon (index unique) + crédit 1 fois
  await reset();
  await new PlaceBet(bets, odds, wallet, { next: () => 'cc1' }, uow).execute({ userId: 'u1', outcomeId: 'o1', stake: 20 });
  const both = await Promise.allSettled([
    settle.execute({ outcomes: ['o1'], winningOutcomeId: 'o1', voided: false }),
    settle.execute({ outcomes: ['o1'], winningOutcomeId: 'o1', voided: false }),
  ]);
  assert.ok(both.every((r) => r.status === 'fulfilled')); // l'un règle, l'autre échoue PROPREMENT (résilience)
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM bet_events WHERE "betId"=$1 AND type=$2', ['cc1', 'BetWon']))[0].c, 1);
  assert.strictEqual(await betStatusOf('cc1'), 'WON');
  assert.strictEqual(await balanceOf('u1'), 120); // crédité une seule fois
  console.log('\u2713 settlement CONCURRENT : 1 seul BetWon (index unique partiel), credit 1 fois (solde 120)');

  // 17) PLAFOND QUOTIDIEN (BET-13) : 2 paris concurrents pres du plafond -> seul le total autorise passe
  await reset();
  const compliance = new TypeOrmComplianceStore(ds, ctx);
  await compliance.setDailyCap('u1', 30); // plafond 30
  const guard = new ReserveStake(compliance, new CompliancePolicyRegistry([new DailyCapPolicy()]));
  const capRace = await Promise.allSettled([
    new PlaceBet(bets, odds, wallet, { next: () => 'capA' }, uow, guard).execute({ userId: 'u1', outcomeId: 'o1', stake: 20 }),
    new PlaceBet(bets, odds, wallet, { next: () => 'capB' }, uow, guard).execute({ userId: 'u1', outcomeId: 'o1', stake: 20 }),
  ]);
  assert.strictEqual(capRace.filter((r) => r.status === 'fulfilled').length, 1); // un seul passe (20<=30)
  assert.strictEqual(capRace.filter((r) => r.status === 'rejected').length, 1); // l'autre refuse (40>30)
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM bets'))[0].c, 1); // 1 seul pari
  assert.strictEqual(await balanceOf('u1'), 80); // debite une seule fois
  assert.strictEqual(Number((await ds.query('SELECT staked FROM rg_daily_stakes WHERE "userId"=$1', ['u1']))[0].staked), 20); // total du jour = 20 (pas 40)
  console.log('\u2713 plafond quotidien : 2 paris concurrents pres du plafond -> seul le total autorise passe (anti-course FOR UPDATE)');

  // 18) IDEMPOTENCE + PLAFOND : retry meme cle -> mise comptee UNE fois dans le total du jour
  await reset();
  const compliance2 = new TypeOrmComplianceStore(ds, ctx);
  await compliance2.setDailyCap('u1', 100);
  const guard2 = new ReserveStake(compliance2, new CompliancePolicyRegistry([new DailyCapPolicy()]));
  const idemGuarded = new IdempotentPlaceBet(
    new PlaceBet(bets, odds, wallet, { next: () => 'idemcap' }, uow, guard2),
    new TypeOrmIdempotencyStore(ds, ctx),
    uow,
  );
  const capInp = { userId: 'u1', outcomeId: 'o1', stake: 30 };
  await idemGuarded.execute({ ...capInp, idempotencyKey: 'cap-idem', requestHash: hashOf(capInp) });
  await idemGuarded.execute({ ...capInp, idempotencyKey: 'cap-idem', requestHash: hashOf(capInp) }); // retry meme cle
  assert.strictEqual(Number((await ds.query('SELECT staked FROM rg_daily_stakes WHERE "userId"=$1', ['u1']))[0].staked), 30); // comptee UNE fois (pas 60)
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM bets'))[0].c, 1);
  console.log('\u2713 idempotence + plafond : retry meme cle -> mise comptee une fois (staked=30, 1 pari)');

  await ds.destroy();
  await pg.stop();
  console.log('\nATOMICITE PG REELLE : OK — zero perte demontree (defi 3).');
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
