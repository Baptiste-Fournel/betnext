/* eslint-disable */
// Seed REPRODUCTIBLE (BET-19) : un wallet de démo OUVERT (solde + entrée d'ouverture du ledger) et
// UN marché N-issues. Idempotent (ON CONFLICT DO NOTHING) → rejouable sans doublon.
// Lancer : npm run db:seed   (utilise DATABASE_URL, défaut = Postgres local du docker-compose)
const { DataSource } = require('typeorm');

const DEMO_USER = 'demo-player';
const DEMO_OPENING = 100;
const DEMO_MARKET_ID = 'mkt-demo-lol';

/** Applique le seed sur une DataSource déjà initialisée + migrée. Idempotent. */
async function runSeed(dataSource) {
  // Wallet de démo : ouverture atomique (solde + entrée OPENING du ledger), comme le funding adapter.
  await dataSource.query(
    'INSERT INTO wallets ("userId", "balance") VALUES ($1, $2) ON CONFLICT ("userId") DO NOTHING',
    [DEMO_USER, DEMO_OPENING],
  );
  await dataSource.query(
    'INSERT INTO wallet_operations ("opKey", "userId", "amount", "kind") VALUES ($1, $2, $3, $4) ON CONFLICT ("opKey") DO NOTHING',
    [`opening:${DEMO_USER}`, DEMO_USER, DEMO_OPENING, 'OPENING'],
  );
  // Un marché de démo (modèle N-issues : 3 issues).
  const outcomes = [
    { id: `${DEMO_MARKET_ID}-1`, label: 'Victoire Team A' },
    { id: `${DEMO_MARKET_ID}-2`, label: 'Victoire Team B' },
    { id: `${DEMO_MARKET_ID}-3`, label: 'Match nul' },
  ];
  await dataSource.query(
    'INSERT INTO markets ("id", "name", "game", "outcomes") VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT ("id") DO NOTHING',
    [DEMO_MARKET_ID, 'BetNext Major — Team A vs Team B', 'LoL', JSON.stringify(outcomes)],
  );
  return { user: DEMO_USER, opening: DEMO_OPENING, marketId: DEMO_MARKET_ID };
}

module.exports = { runSeed, DEMO_USER, DEMO_OPENING, DEMO_MARKET_ID };

// Exécution CLI : connecte (DATABASE_URL), joue les migrations, applique le seed.
if (require.main === module) {
  (async () => {
    const { ENTITIES, MIGRATIONS } = require('../dist/persistence/schema.js');
    const url = process.env.DATABASE_URL || 'postgres://betnext:betnext@localhost:5432/betnext';
    const ds = new DataSource({ type: 'postgres', url, entities: ENTITIES, migrations: MIGRATIONS });
    await ds.initialize();
    await ds.runMigrations();
    const res = await runSeed(ds);
    await ds.destroy();
    console.log('Seed OK :', JSON.stringify(res));
    process.exit(0);
  })().catch((e) => {
    console.error('ECHEC seed:', e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
