import { DataSource } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { TypeOrmMatchLinkStore } from './TypeOrmMatchLinkStore';
import { MatchLinkRecord } from './MatchLinkRecord';

async function newDataSource(): Promise<DataSource> {
  const db = newDb();
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0 (pg-mem)',
  });
  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'betnext',
  });
  const ds: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [MatchLinkRecord],
    synchronize: false,
  });
  await ds.initialize();
  await ds.synchronize();
  return ds;
}

describe('TypeOrmMatchLinkStore (pg-mem)', () => {
  let ds: DataSource;
  let store: TypeOrmMatchLinkStore;

  beforeEach(async () => {
    ds = await newDataSource();
    store = new TypeOrmMatchLinkStore(ds);
  });

  afterEach(async () => {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  });

  it('shouldPersistAndReloadLinkIdentically_WhenLinkSaved', async () => {
    // Arrange
    await store.save({
      matchId: 'ext-1',
      marketId: 'mkt-1',
      outcomes: ['mkt-1-1', 'mkt-1-2'],
      mapping: { HOME: 'mkt-1-1', AWAY: 'mkt-1-2' },
      league: 'LEC',
      startTime: '2026-06-28T03:00:00Z',
    });

    // Act
    const reloaded = await store.find('ext-1');

    // Assert
    expect(reloaded).toEqual({
      matchId: 'ext-1',
      marketId: 'mkt-1',
      outcomes: ['mkt-1-1', 'mkt-1-2'],
      mapping: { HOME: 'mkt-1-1', AWAY: 'mkt-1-2' },
      league: 'LEC',
      startTime: '2026-06-28T03:00:00Z',
    });
  });

  it('shouldKeepSingleRowAndKeepFindTruthy_WhenSameMatchIdSavedTwice', async () => {
    // Arrange
    const link = {
      matchId: 'ext-2',
      marketId: 'mkt-2',
      outcomes: ['mkt-2-1', 'mkt-2-2'],
      mapping: { HOME: 'mkt-2-1', AWAY: 'mkt-2-2' },
    };

    // Act
    await store.save(link);
    await store.save(link);

    // Assert
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(await store.find('ext-2')).not.toBeNull();
  });

  it('shouldOmitAbsentOptionalFields_WhenLinkHasNoRegionLeagueOrStartTime', async () => {
    // Arrange
    await store.save({
      matchId: 'ext-3',
      marketId: 'mkt-3',
      outcomes: ['mkt-3-1', 'mkt-3-2'],
      mapping: { HOME: 'mkt-3-1', AWAY: 'mkt-3-2' },
    });

    // Act
    const reloaded = await store.find('ext-3');

    // Assert
    expect(reloaded).toEqual({
      matchId: 'ext-3',
      marketId: 'mkt-3',
      outcomes: ['mkt-3-1', 'mkt-3-2'],
      mapping: { HOME: 'mkt-3-1', AWAY: 'mkt-3-2' },
    });
  });

  it('shouldReturnNull_WhenMatchIdUnknown', async () => {
    // Arrange
    await store.save({
      matchId: 'ext-4',
      marketId: 'mkt-4',
      outcomes: ['mkt-4-1', 'mkt-4-2'],
      mapping: { HOME: 'mkt-4-1', AWAY: 'mkt-4-2' },
    });

    // Act
    const reloaded = await store.find('does-not-exist');

    // Assert
    expect(reloaded).toBeNull();
  });

  it('shouldListEverySavedLink_WhenMultipleMatchesSaved', async () => {
    // Arrange
    await store.save({
      matchId: 'ext-5',
      marketId: 'mkt-5',
      outcomes: ['mkt-5-1', 'mkt-5-2'],
      mapping: { HOME: 'mkt-5-1', AWAY: 'mkt-5-2' },
    });
    await store.save({
      matchId: 'ext-6',
      marketId: 'mkt-6',
      outcomes: ['mkt-6-1', 'mkt-6-2'],
      mapping: { HOME: 'mkt-6-1', AWAY: 'mkt-6-2' },
    });

    // Act
    const all = await store.list();

    // Assert
    expect(all.map((l) => l.matchId).sort()).toEqual(['ext-5', 'ext-6']);
  });
});
