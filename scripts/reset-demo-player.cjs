/* eslint-disable */
const { Client } = require('pg');

const USER = 'demo-player';
const OPENING = 100;
const APPLY = process.argv.includes('--apply');

const fail = (m) => { console.error(`ECHEC: ${m}`); process.exit(1); };

const counts = async (c) => ({
  bets: Number((await c.query(`SELECT count(*)::int n FROM bets WHERE "userId"=$1`, [USER])).rows[0].n),
  betEvents: Number((await c.query(`SELECT count(*)::int n FROM bet_events WHERE "betId" IN (SELECT id FROM bets WHERE "userId"=$1)`, [USER])).rows[0].n),
  idempotency: Number((await c.query(`SELECT count(*)::int n FROM idempotency_keys WHERE "betId" IN (SELECT id FROM bets WHERE "userId"=$1)`, [USER])).rows[0].n),
  walletOps: Number((await c.query(`SELECT count(*)::int n FROM wallet_operations WHERE "userId"=$1`, [USER])).rows[0].n),
  dailyStakes: Number((await c.query(`SELECT count(*)::int n FROM rg_daily_stakes WHERE "userId"=$1`, [USER])).rows[0].n),
  balance: Number((await c.query(`SELECT COALESCE(balance,0) b FROM wallets WHERE "userId"=$1`, [USER])).rows[0]?.b ?? 0),
});

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL requis.');
  const c = new Client({ connectionString: url });
  await c.connect();

  const others = (await c.query(`SELECT DISTINCT "userId" FROM bets WHERE "userId" <> $1`, [USER])).rows;
  if (others.length) fail(`paris d'autres utilisateurs détectés (${others.map((r) => r.userId).join(',')}) — abandon.`);

  const before = await counts(c);
  console.log(`\n=== RESET ${USER} (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log('AVANT :', JSON.stringify(before));

  if (!APPLY) {
    console.log(`\nDRY-RUN: aucune écriture. Relancez avec --apply.`);
    await c.end();
    process.exit(0);
  }

  await c.query('BEGIN');
  try {
    await c.query(`DELETE FROM idempotency_keys WHERE "betId" IN (SELECT id FROM bets WHERE "userId"=$1)`, [USER]);
    await c.query(`DELETE FROM bets WHERE "userId"=$1`, [USER]);
    await c.query(`DELETE FROM rg_daily_stakes WHERE "userId"=$1`, [USER]);
    await c.query(`DELETE FROM wallet_operations WHERE "userId"=$1`, [USER]);
    await c.query(`UPDATE wallets SET balance=$2 WHERE "userId"=$1`, [USER, OPENING]);
    await c.query(
      `INSERT INTO wallet_operations ("opKey","userId","amount","kind") VALUES ($1,$2,$3,'OPENING') ON CONFLICT ("opKey") DO NOTHING`,
      [`opening:${USER}`, USER, OPENING],
    );
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    await c.end();
    fail(`reset annulé (ROLLBACK): ${e.message}`);
  }

  const after = await counts(c);
  const ledger = Number((await c.query(`SELECT COALESCE(SUM(amount),0) s FROM wallet_operations WHERE "userId"=$1`, [USER])).rows[0].s);
  console.log('APRÈS :', JSON.stringify(after));
  console.log(`Σ ledger ${USER} = ${ledger} (doit = solde ${after.balance})`);
  if (after.bets !== 0 || after.betEvents !== 0 || after.balance !== OPENING || ledger !== OPENING) {
    fail('invariants post-reset non respectés.');
  }
  console.log(`✓ ${USER} remis à zéro : paris/historique/stats/ledger purgés, solde = ${OPENING} (ouverture), compte conservé.`);
  await c.end();
  process.exit(0);
})().catch((e) => { console.error('ECHEC:', e && e.stack ? e.stack : e); process.exit(1); });
