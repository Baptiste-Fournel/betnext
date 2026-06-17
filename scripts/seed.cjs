/* eslint-disable */
const { DataSource } = require('typeorm');
const { scryptSync, randomBytes } = require('node:crypto');

const DEMO_OPENING = 100;
const DEMO_MARKET_ID = 'mkt-demo-lol';
// Marché « cible de règlement » : reste OUVERT après le seed pur SQL ; c'est l'enrichissement
// runtime (scripts/demo-enrich.cjs) qui y pose un pari puis le règle → un pari GAGNÉ + des stats
// non vides, sans bricoler l'event-sourcing/le ledger à la main.
const DEMO_SETTLED_MARKET_ID = 'mkt-demo-settled';
const DEMO_PASSWORD = 'changeme123';
const ACCOUNTS = [
  { id: 'demo-player', username: 'demo-player', role: 'PLAYER' },
  { id: 'demo-manager', username: 'demo-manager', role: 'MANAGER' },
];

function hashPassword(plain) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(plain, salt, 64).toString('hex')}`;
}

async function openWallet(ds, userId, opening) {
  await ds.query(
    'INSERT INTO wallets ("userId", "balance") VALUES ($1, $2) ON CONFLICT ("userId") DO NOTHING',
    [userId, opening],
  );
  await ds.query(
    'INSERT INTO wallet_operations ("opKey", "userId", "amount", "kind") VALUES ($1, $2, $3, $4) ON CONFLICT ("opKey") DO NOTHING',
    [`opening:${userId}`, userId, opening, 'OPENING'],
  );
}

async function runSeed(dataSource) {
  for (const acc of ACCOUNTS) {
    await dataSource.query(
      'INSERT INTO users ("id", "username", "passwordHash", "role") VALUES ($1, $2, $3, $4) ON CONFLICT ("id") DO NOTHING',
      [acc.id, acc.username, hashPassword(DEMO_PASSWORD), acc.role],
    );
    await openWallet(dataSource, acc.id, DEMO_OPENING);
  }
  const outcomes = [
    { id: `${DEMO_MARKET_ID}-1`, label: 'Victoire Team A' },
    { id: `${DEMO_MARKET_ID}-2`, label: 'Victoire Team B' },
    { id: `${DEMO_MARKET_ID}-3`, label: 'Match nul' },
  ];
  await dataSource.query(
    'INSERT INTO markets ("id", "name", "game", "outcomes") VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT ("id") DO NOTHING',
    [DEMO_MARKET_ID, 'BetNext Major — Team A vs Team B', 'LoL', JSON.stringify(outcomes)],
  );
  const settledOutcomes = [
    { id: `${DEMO_SETTLED_MARKET_ID}-1`, label: 'Victoire G2 Esports' },
    { id: `${DEMO_SETTLED_MARKET_ID}-2`, label: 'Victoire Fnatic' },
    { id: `${DEMO_SETTLED_MARKET_ID}-3`, label: 'Match nul' },
  ];
  await dataSource.query(
    'INSERT INTO markets ("id", "name", "game", "outcomes") VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT ("id") DO NOTHING',
    [DEMO_SETTLED_MARKET_ID, 'LEC — G2 vs Fnatic (clôturé)', 'LoL', JSON.stringify(settledOutcomes)],
  );
  // Les marchés des matchs pro à venir ne sont PAS seedés en SQL : ils sont créés à la demande par
  // l'ingestion du feed LoL Esports (BET-30, POST /game-integration/esports/ingest), déclenchée
  // par scripts/demo-enrich.cjs au démarrage de la stack de démo.
  return {
    accounts: ACCOUNTS.map((a) => a.username),
    opening: DEMO_OPENING,
    marketId: DEMO_MARKET_ID,
    settledMarketId: DEMO_SETTLED_MARKET_ID,
  };
}

module.exports = {
  runSeed,
  ACCOUNTS,
  DEMO_OPENING,
  DEMO_MARKET_ID,
  DEMO_SETTLED_MARKET_ID,
  DEMO_PASSWORD,
};

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
