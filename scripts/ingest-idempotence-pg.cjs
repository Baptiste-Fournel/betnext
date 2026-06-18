/* eslint-disable */
require('reflect-metadata');
const assert = require('node:assert');
const { rmSync } = require('node:fs');
const { DataSource } = require('typeorm');
const { ENTITIES, MIGRATIONS } = require('../dist/persistence/schema.js');
const { TypeOrmMarketCatalog } = require('../dist/contexts/catalog/infrastructure/persistence/TypeOrmMarketCatalog.js');
const { CreateMarket } = require('../dist/contexts/catalog/application/CreateMarket.js');
const { CatalogMarketCreation } = require('../dist/contexts/catalog/infrastructure/CatalogMarketCreation.js');
const { TypeOrmMatchLinkStore } = require('../dist/contexts/game-integration/infrastructure/persistence/TypeOrmMatchLinkStore.js');
const { IngestMatchMarket } = require('../dist/contexts/game-integration/application/IngestMatchMarket.js');
const { IngestUpcomingMatches } = require('../dist/contexts/game-integration/application/IngestUpcomingMatches.js');

const DATA_DIR = '/tmp/pgdata_betnext_ingest';
const PORT = 55439;

const SCHEDULE = {
  source: 'live',
  matches: [
    { externalId: '115570934355614497', game: 'LoL', league: 'MSI', teamA: 'T1', teamB: 'Team Liquid', startTime: '2026-06-28T03:00:00Z' },
    { externalId: '115570934355614503', game: 'LoL', league: 'MSI', teamA: 'Karmine Corp', teamB: 'DCG', startTime: '2026-06-28T08:00:00Z' },
  ],
};
const provider = { fetchUpcoming: async () => SCHEDULE };

const newIngestion = (ds) => {
  const marketCreation = new CatalogMarketCreation(new CreateMarket(new TypeOrmMarketCatalog(ds)));
  const linkStore = new TypeOrmMatchLinkStore(ds);
  return new IngestUpcomingMatches(provider, new IngestMatchMarket(marketCreation, linkStore), linkStore);
};

const countMarkets = async (ds) => Number((await ds.query('SELECT count(*)::int AS c FROM markets'))[0].c);
const countLinks = async (ds) => Number((await ds.query('SELECT count(*)::int AS c FROM match_links'))[0].c);

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
  await ds.runMigrations();

  const first = await newIngestion(ds).execute();
  assert.strictEqual(first.ingested, 2, '1er run : 2 marchés ingérés');
  assert.strictEqual(await countMarkets(ds), 2, '1er run : 2 marchés en base');
  assert.strictEqual(await countLinks(ds), 2, '1er run : 2 liens en base');
  console.log('✓ 1er run : 2 matchs → 2 marchés + 2 liens');

  const second = await newIngestion(ds).execute();
  assert.strictEqual(second.ingested, 0, '2e run : aucun nouveau marché');
  assert.strictEqual(second.skipped, 2, '2e run : 2 matchs sautés (déjà liés)');
  assert.strictEqual(await countMarkets(ds), 2, '2e run : toujours 2 marchés (pas de doublon)');
  console.log('✓ 2e run (même process) : 0 ingéré, 2 sautés, toujours 2 marchés');

  const afterRestart = await newIngestion(ds).execute();
  assert.strictEqual(afterRestart.ingested, 0, 'post-restart : aucun nouveau marché');
  assert.strictEqual(afterRestart.skipped, 2, 'post-restart : 2 matchs sautés');
  assert.strictEqual(await countMarkets(ds), 2, 'post-restart : toujours 2 marchés (idempotence survit au restart)');
  console.log('✓ post-restart (nouvelle instance de store, base persistante) : toujours 2 marchés — plus de doublon');

  await ds.destroy();
  await pg.stop();
  console.log('\nINGESTION IDEMPOTENTE PG REEL : OK — ré-ingestion et restart ne recréent aucun marché en doublon (BET-38).');
  process.exit(0);
})().catch((e) => {
  console.error('ECHEC:', e && e.stack ? e.stack : e);
  process.exit(1);
});
