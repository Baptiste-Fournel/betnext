/* eslint-disable */
// demo-reset.cjs — repart d'un état de démo PROPRE : migrations → TRUNCATE des tables applicatives
// → seed. Idempotent et reproductible (à lancer avant une soutenance pour effacer les paris/dépôts
// joués pendant les répétitions). Cible la base pointée par DATABASE_URL.
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { ENTITIES, MIGRATIONS } = require('../dist/persistence/schema.js');
const { runSeed } = require('./seed.cjs');

// Ordre sans importance : TRUNCATE ... CASCADE remet tout à zéro d'un coup.
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
  const url = process.env.DATABASE_URL || 'postgres://betnext:betnext@localhost:5432/betnext';
  const ds = new DataSource({ type: 'postgres', url, entities: ENTITIES, migrations: MIGRATIONS });
  await ds.initialize();
  await ds.runMigrations();
  await ds.query(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  const res = await runSeed(ds);
  await ds.destroy();
  console.log('Reset OK (table rase + seed) :', JSON.stringify(res));
  process.exit(0);
})().catch((e) => {
  console.error('ECHEC reset:', e && e.stack ? e.stack : e);
  process.exit(1);
});
