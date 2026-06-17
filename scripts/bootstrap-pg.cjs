/* eslint-disable */
require('reflect-metadata');
const assert = require('node:assert');
const { rmSync } = require('node:fs');
const { DataSource } = require('typeorm');
const { ENTITIES, MIGRATIONS } = require('../dist/persistence/schema.js');
const { runSeed, ACCOUNTS, DEMO_MARKET_ID } = require('./seed.cjs');

const DATA_DIR = '/tmp/pgdata_betnext_bootstrap';
const PORT = 55438;
const TABLES = [
  'bets',
  'bet_events',
  'outbox',
  'processed_messages',
  'idempotency_keys',
  'wallets',
  'wallet_operations',
  'rg_caps',
  'rg_daily_stakes',
  'markets',
  'users',
];

(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  rmSync(DATA_DIR, { recursive: true, force: true });
  const pg = new EmbeddedPostgres({ databaseDir: DATA_DIR, user: 'betnext', password: 'betnext', port: PORT, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('betnext');
  const url = `postgres://betnext:betnext@127.0.0.1:${PORT}/betnext`;
  const ds = new DataSource({ type: 'postgres', url, entities: ENTITIES, migrations: MIGRATIONS });
  await ds.initialize();

  const applied = await ds.runMigrations();
  assert.ok(applied.length >= 10, `attendu >= 10 migrations, obtenu ${applied.length}`);
  for (const t of TABLES) {
    await ds.query(`SELECT count(*)::int AS c FROM "${t}"`);
  }
  console.log(`✓ schéma vierge → ${applied.length} migrations jouées, ${TABLES.length} tables présentes (app fonctionnelle)`);

  const second = await ds.runMigrations();
  assert.strictEqual(second.length, 0, '2e run : aucune migration en attente');

  await ds.query('DROP TABLE IF EXISTS "migrations"');
  const replay = await ds.runMigrations();
  assert.ok(replay.length >= 10, 'rejeu complet des migrations sans erreur (idempotence SQL)');
  console.log('✓ migrations idempotentes : 2e run = 0 en attente, et rejeu SQL complet sans erreur');

  await runSeed(ds);
  await runSeed(ds);
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM users'))[0].c, ACCOUNTS.length);
  const hashes = await ds.query('SELECT "passwordHash" FROM users');
  for (const row of hashes) {
    assert.ok(row.passwordHash.startsWith('scrypt$'), 'mot de passe stocké haché (scrypt)');
    assert.ok(!row.passwordHash.includes('changeme'), 'aucun mot de passe en clair stocké');
  }
  for (const acc of ACCOUNTS) {
    const bal = Number((await ds.query('SELECT balance FROM wallets WHERE "userId"=$1', [acc.id]))[0].balance);
    const led = await ds.query('SELECT COALESCE(SUM(amount),0) AS s, count(*)::int AS c FROM wallet_operations WHERE "userId"=$1', [acc.id]);
    assert.strictEqual(bal, 100);
    assert.strictEqual(Number(led[0].s), 100);
    assert.strictEqual(led[0].c, 1);
  }
  const market = await ds.query('SELECT jsonb_array_length(outcomes) AS n FROM markets WHERE id=$1', [DEMO_MARKET_ID]);
  assert.strictEqual(market.length, 1);
  assert.strictEqual(Number(market[0].n), 3);
  const { FEATURED_FIXTURES } = require('../dist/contexts/game-integration/demo/featured-fixtures.js');
  const expectedMarkets = 1 + FEATURED_FIXTURES.length;
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM markets'))[0].c, expectedMarkets);
  console.log(`✓ seed reproductible : ${ACCOUNTS.length} comptes hashés + wallets (Σ ledger=solde=100) + ${expectedMarkets} marchés (1 démo 3 issues + ${FEATURED_FIXTURES.length} featured), rejeu sans doublon`);

  await ds.destroy();
  await pg.stop();
  console.log('\nBOOTSTRAP PG REEL : OK — schéma vierge → app fonctionnelle, migrations idempotentes/rejouables, seed reproductible (BET-19/BET-20).');
  process.exit(0);
})().catch((e) => {
  console.error('ECHEC:', e && e.stack ? e.stack : e);
  process.exit(1);
});
