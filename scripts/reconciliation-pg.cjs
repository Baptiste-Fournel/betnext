/* eslint-disable */
// Réconciliation argent (BET-15) sur un VRAI Postgres (embedded-postgres, sans Docker). Prouve que
// le filet « zéro perte après réconciliation » : (1) ledger complet -> Σ(mouvements)=solde, (2) une
// dérive injectée HORS ledger est DÉTECTÉE et RAPPORTÉE sans auto-correction, (3) un Outbox non drainé
// (async en vol) n'est PAS une fausse dérive, (4) le job est idempotent (lecture seule).
// Lancer : npm run test:reconciliation:pg
require('reflect-metadata');
const assert = require('node:assert');
const { rmSync } = require('node:fs');
const { DataSource } = require('typeorm');
const { TransactionContext } = require('../dist/persistence/TransactionContext.js');
const { TypeOrmBetRepository } = require('../dist/contexts/betting/infrastructure/persistence/TypeOrmBetRepository.js');
const { TypeOrmUnitOfWork } = require('../dist/contexts/betting/infrastructure/persistence/TypeOrmUnitOfWork.js');
const { TypeOrmWalletDebitAdapter } = require('../dist/contexts/wallet/infrastructure/persistence/TypeOrmWalletDebitAdapter.js');
const { TypeOrmWalletCreditAdapter } = require('../dist/contexts/wallet/infrastructure/persistence/TypeOrmWalletCreditAdapter.js');
const { TypeOrmWalletFundingAdapter } = require('../dist/contexts/wallet/infrastructure/persistence/TypeOrmWalletFundingAdapter.js');
const { TypeOrmWalletReconciliationStore } = require('../dist/contexts/wallet/infrastructure/persistence/TypeOrmWalletReconciliationStore.js');
const { ReconcileWallets } = require('../dist/contexts/wallet/application/ReconcileWallets.js');
const { BetRecord } = require('../dist/contexts/betting/infrastructure/persistence/BetRecord.js');
const { BetEventRecord } = require('../dist/contexts/betting/infrastructure/persistence/BetEventRecord.js');
const { OutboxRecord } = require('../dist/contexts/betting/infrastructure/persistence/OutboxRecord.js');
const { ProcessedMessageRecord } = require('../dist/messaging/ProcessedMessageRecord.js');
const { IdempotencyKeyRecord } = require('../dist/contexts/betting/infrastructure/persistence/IdempotencyKeyRecord.js');
const { WalletRecord } = require('../dist/contexts/wallet/infrastructure/persistence/WalletRecord.js');
const { WalletOperationRecord } = require('../dist/contexts/wallet/infrastructure/persistence/WalletOperationRecord.js');
const { PlaceBet } = require('../dist/contexts/betting/application/PlaceBet.js');
const { SettleMarket } = require('../dist/contexts/betting/application/SettleMarket.js');
const { SettlementStrategyFactory } = require('../dist/contexts/betting/application/SettlementStrategyFactory.js');
const { Odds } = require('../dist/shared-kernel/domain/Odds.js');
const { InitBetting1718200000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting.js');
const { InitWallet1718300000000 } = require('../dist/contexts/wallet/infrastructure/persistence/migrations/1718300000000-InitWallet.js');
const { InitOutbox1718400000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718400000000-InitOutbox.js');
const { InitProcessedMessages1718500000000 } = require('../dist/messaging/migrations/1718500000000-InitProcessedMessages.js');
const { InitIdempotencyKeys1718600000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718600000000-InitIdempotencyKeys.js');
const { InitWalletOperations1718700000000 } = require('../dist/contexts/wallet/infrastructure/persistence/migrations/1718700000000-InitWalletOperations.js');
const { InitBetSettlementGuard1718800000000 } = require('../dist/contexts/betting/infrastructure/persistence/migrations/1718800000000-InitBetSettlementGuard.js');
const { InitCompliance1718900000000 } = require('../dist/contexts/compliance/infrastructure/persistence/migrations/1718900000000-InitCompliance.js');

const DATA_DIR = '/tmp/pgdata_betnext_recon';
const PORT = 55436;

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
  await ds.runMigrations();

  const ctx = new TransactionContext();
  const bets = new TypeOrmBetRepository(ds, ctx);
  const debit = new TypeOrmWalletDebitAdapter(ctx);
  const credit = new TypeOrmWalletCreditAdapter(ctx);
  const uow = new TypeOrmUnitOfWork(ds, ctx);
  const funding = new TypeOrmWalletFundingAdapter(ds);
  const recon = new ReconcileWallets(new TypeOrmWalletReconciliationStore(ds));
  const settle = new SettleMarket(bets, credit, new SettlementStrategyFactory(), uow);
  const odds = { currentOdds: async () => ({ value: Odds.of(2), provisional: false }) };
  const placeBet = (id, input) => new PlaceBet(bets, odds, debit, { next: () => id }, uow).execute(input);
  const reset = async () => ds.query('TRUNCATE "bets", "bet_events", "outbox", "processed_messages", "idempotency_keys", "wallet_operations", "wallets", "rg_caps", "rg_daily_stakes" RESTART IDENTITY');
  const balanceOf = async (u) => Number((await ds.query('SELECT balance FROM wallets WHERE "userId"=$1', [u]))[0].balance);
  const ledgerSumOf = async (u) => Number((await ds.query('SELECT COALESCE(SUM(amount),0) AS s FROM wallet_operations WHERE "userId"=$1', [u]))[0].s);

  // 1) OUVERTURE : écrit l'entrée d'ouverture (OPENING) et reste balanced ; ré-ouverture = no-op
  await reset();
  assert.strictEqual(await funding.open('u1', 100), true);
  const opening = await ds.query("SELECT amount FROM wallet_operations WHERE \"userId\"='u1' AND kind='OPENING'");
  assert.strictEqual(opening.length, 1);
  assert.strictEqual(Number(opening[0].amount), 100);
  assert.strictEqual(await funding.open('u1', 999), false); // idempotent
  assert.strictEqual(await balanceOf('u1'), 100); // ré-ouverture n'a pas changé le solde
  let r = await recon.execute();
  assert.strictEqual(r.balanced, true);
  assert.strictEqual(r.walletsChecked, 1);
  console.log('✓ ouverture : entrée OPENING +100 écrite, ré-ouverture no-op, réconciliation balanced');

  // 2) CYCLE COMPLET open -> pari -> règlement gagné : Σ(ledger) == solde à chaque étape
  await reset();
  await funding.open('u1', 100);
  await placeBet('rb1', { userId: 'u1', outcomeId: 'o1', stake: 20 }); // -20
  assert.strictEqual(await balanceOf('u1'), 80);
  assert.strictEqual(await ledgerSumOf('u1'), 80);
  assert.strictEqual((await recon.execute()).balanced, true);
  await settle.execute({ outcomes: ['o1'], winningOutcomeId: 'o1', voided: false }); // +40 (cote figée 2.0)
  assert.strictEqual(await balanceOf('u1'), 120);
  assert.strictEqual(await ledgerSumOf('u1'), 120);
  assert.strictEqual((await recon.execute()).balanced, true);
  console.log('✓ cycle open/pari/règlement : Σ(ledger) == solde (120) à chaque étape, balanced');

  // 3) ASYNC EN VOL : un Outbox NON DRAINÉ (events en file) n'est PAS une dérive
  await reset();
  await funding.open('u1', 100);
  await placeBet('rb2', { userId: 'u1', outcomeId: 'o1', stake: 20 });
  const unpublished = (await ds.query('SELECT count(*)::int AS c FROM outbox WHERE "publishedAt" IS NULL'))[0].c;
  assert.ok(unpublished >= 1, 'au moins un event en file (non publié)');
  r = await recon.execute();
  assert.strictEqual(r.balanced, true); // argent cohérent malgré l'async en vol
  console.log('✓ en vol : Outbox non drainé (' + unpublished + ' event[s] en file) -> AUCUNE fausse dérive (balanced)');

  // 4) DÉRIVE INJECTÉE hors ledger : détectée, rapportée, et JAMAIS corrigée en douce
  await reset();
  await funding.open('u1', 100);
  await placeBet('rb3', { userId: 'u1', outcomeId: 'o1', stake: 20 }); // solde 80, ledger 80
  await ds.query("UPDATE wallets SET balance = balance + 50 WHERE \"userId\"='u1'"); // corruption: +50 SANS mouvement
  r = await recon.execute();
  assert.strictEqual(r.balanced, false);
  assert.strictEqual(r.drifts.length, 1);
  assert.deepStrictEqual(r.drifts[0], { userId: 'u1', expectedBalance: 80, actualBalance: 130, difference: 50 });
  assert.strictEqual(await balanceOf('u1'), 130); // PAS d'auto-correction : le solde reste dérivé
  console.log('✓ dérive injectée (+50 hors ledger) : DÉTECTÉE et rapportée (attendu 80, réel 130, écart +50), AUCUNE correction');

  // 5) IDEMPOTENT au rejeu : 2 exécutions -> rapport IDENTIQUE et ZÉRO écriture (lecture seule)
  const opsBefore = (await ds.query('SELECT count(*)::int AS c FROM wallet_operations'))[0].c;
  const r1 = await recon.execute();
  const r2 = await recon.execute();
  assert.deepStrictEqual(r1.drifts, r2.drifts);
  assert.strictEqual(r1.balanced, r2.balanced);
  assert.strictEqual(r1.walletsChecked, r2.walletsChecked);
  const opsAfter = (await ds.query('SELECT count(*)::int AS c FROM wallet_operations'))[0].c;
  assert.strictEqual(opsAfter, opsBefore); // aucune ligne ajoutée
  assert.strictEqual(await balanceOf('u1'), 130); // solde inchangé par le job
  console.log('✓ idempotent : rejeu -> rapport identique, 0 écriture (wallet_operations inchangé), solde inchangé');

  // 6) MULTI-WALLETS : seul le wallet en dérive est rapporté, le sain ne l'est pas
  await reset();
  await funding.open('u1', 100);
  await funding.open('u2', 50);
  await placeBet('m1', { userId: 'u1', outcomeId: 'o1', stake: 20 }); // u1 sain : 80 == 80
  await ds.query("UPDATE wallets SET balance = balance - 10 WHERE \"userId\"='u2'"); // u2 dérive -10
  r = await recon.execute();
  assert.strictEqual(r.walletsChecked, 2);
  assert.strictEqual(r.drifts.length, 1);
  assert.strictEqual(r.drifts[0].userId, 'u2');
  assert.strictEqual(r.drifts[0].difference, -10);
  console.log('✓ multi-wallets : seul le wallet en dérive (u2, écart -10) est rapporté ; le sain (u1) ne l’est pas');

  // 7) MONEY-SAFETY DU CRÉDIT (A-1a) : créditer un wallet INEXISTANT lève → ledger rollback, 0 orpheline
  await reset();
  let threwCredit = false;
  try {
    await uow.withTransaction(async () => {
      await credit.credit('ghost', 40, 'payout:ghostbet');
    });
  } catch {
    threwCredit = true;
  }
  assert.ok(threwCredit, 'crédit vers wallet inexistant doit lever');
  assert.strictEqual(
    (await ds.query('SELECT count(*)::int AS c FROM wallet_operations'))[0].c,
    0,
  ); // la ligne ledger a été rollback → aucune orpheline, aucun argent perdu
  assert.strictEqual((await recon.execute()).balanced, true);
  console.log('✓ A-1a : crédit vers wallet inexistant → lève, ledger rollback (0 orpheline), balanced');

  // 8) DÉTECTION D'ORPHELIN (A-1b) : une ligne ledger sans wallet (corruption externe) EST rapportée
  await reset();
  await funding.open('u1', 100);
  await ds.query(
    "INSERT INTO wallet_operations (\"opKey\",\"userId\",\"amount\",\"kind\") VALUES ('orphan:x','ghost',40,'CREDIT')",
  );
  r = await recon.execute();
  assert.strictEqual(r.balanced, false);
  const ghostDrift = r.drifts.find((d) => d.userId === 'ghost');
  assert.ok(ghostDrift, 'orphelin ghost rapporté');
  assert.deepStrictEqual(ghostDrift, {
    userId: 'ghost',
    expectedBalance: 40,
    actualBalance: 0,
    difference: -40,
  });
  console.log("✓ A-1b : ligne ledger ORPHELINE (userId sans wallet) → dérive rapportée (attendu 40, réel 0, écart -40)");

  await ds.destroy();
  await pg.stop();
  console.log('\nRECONCILIATION PG REELLE : OK — dérive détectée/rapportée, sans auto-correction, idempotent (BET-15).');
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
