/* eslint-disable */
// BET-19/BET-20 : prouve qu'un SCHÉMA VIERGE devient une app fonctionnelle sur Postgres, que les
// migrations sont IDEMPOTENTES/REJOUABLES, et que le seed est REPRODUCTIBLE (comptes + wallets +
// marché). Sur un vrai Postgres embarqué. Lancer : npm run test:bootstrap:pg
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

  // 1) SCHÉMA VIERGE → migrations jouées ; toutes les tables existent (app fonctionnelle)
  const applied = await ds.runMigrations();
  assert.ok(applied.length >= 10, `attendu >= 10 migrations, obtenu ${applied.length}`);
  for (const t of TABLES) {
    await ds.query(`SELECT count(*)::int AS c FROM "${t}"`); // ne lève pas → table présente
  }
  console.log(`✓ schéma vierge → ${applied.length} migrations jouées, ${TABLES.length} tables présentes (app fonctionnelle)`);

  // 2) IDEMPOTENT côté suivi TypeORM : un 2e run ne rejoue rien
  const second = await ds.runMigrations();
  assert.strictEqual(second.length, 0, '2e run : aucune migration en attente');

  // 3) REJOUABLE au niveau SQL : on efface le suivi des migrations et on rejoue → IF NOT EXISTS /
  //    CREATE OR REPLACE / DROP ... IF EXISTS rendent chaque up() sûr (aucune erreur)
  await ds.query('DROP TABLE IF EXISTS "migrations"');
  const replay = await ds.runMigrations();
  assert.ok(replay.length >= 10, 'rejeu complet des migrations sans erreur (idempotence SQL)');
  console.log('✓ migrations idempotentes : 2e run = 0 en attente, et rejeu SQL complet sans erreur');

  // 4) SEED REPRODUCTIBLE : 2 exécutions → pas de doublon ; comptes + wallets fonctionnels
  await runSeed(ds);
  await runSeed(ds); // rejeu
  // 4a) deux comptes, mots de passe HASHÉS (jamais en clair)
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM users'))[0].c, ACCOUNTS.length);
  const hashes = await ds.query('SELECT "passwordHash" FROM users');
  for (const row of hashes) {
    assert.ok(row.passwordHash.startsWith('scrypt$'), 'mot de passe stocké haché (scrypt)');
    assert.ok(!row.passwordHash.includes('changeme'), 'aucun mot de passe en clair stocké');
  }
  // 4b) chaque compte a un wallet ouvert, invariant Σ(ledger) == solde tenu, sans doublon au rejeu
  for (const acc of ACCOUNTS) {
    const bal = Number((await ds.query('SELECT balance FROM wallets WHERE "userId"=$1', [acc.id]))[0].balance);
    const led = await ds.query('SELECT COALESCE(SUM(amount),0) AS s, count(*)::int AS c FROM wallet_operations WHERE "userId"=$1', [acc.id]);
    assert.strictEqual(bal, 100);
    assert.strictEqual(Number(led[0].s), 100);
    assert.strictEqual(led[0].c, 1); // une seule entrée d'ouverture (rejeu sans doublon)
  }
  // 4c) un marché à 3 issues, sans doublon
  const market = await ds.query('SELECT jsonb_array_length(outcomes) AS n FROM markets WHERE id=$1', [DEMO_MARKET_ID]);
  assert.strictEqual(market.length, 1);
  assert.strictEqual(Number(market[0].n), 3);
  assert.strictEqual((await ds.query('SELECT count(*)::int AS c FROM markets'))[0].c, 1);
  console.log(`✓ seed reproductible : ${ACCOUNTS.length} comptes hashés + wallets (Σ ledger=solde=100) + 1 marché 3 issues, rejeu sans doublon`);

  await ds.destroy();
  await pg.stop();
  console.log('\nBOOTSTRAP PG REEL : OK — schéma vierge → app fonctionnelle, migrations idempotentes/rejouables, seed reproductible (BET-19/BET-20).');
  process.exit(0);
})().catch((e) => {
  console.error('ECHEC:', e && e.stack ? e.stack : e);
  process.exit(1);
});
