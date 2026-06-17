import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { OutboxRecord } from '../contexts/betting/infrastructure/persistence/OutboxRecord';
import { OutboxRelay } from './OutboxRelay';
import { InMemoryEventBus } from './InMemoryEventBus';
import { OutboxMessage } from './QueuePort';
import { DOMAIN_EVENTS_QUEUE, ODDS_QUEUE } from './topics';
import { OddsCalculator } from '../contexts/pricing/domain/OddsCalculator';
import { RecalculateOddsOnBetPlaced } from '../contexts/pricing/application/RecalculateOddsOnBetPlaced';
import { InMemoryPricingStore } from '../contexts/pricing/infrastructure/InMemoryPricingStore';
import { QueueOddsPublisher } from '../contexts/pricing/infrastructure/QueueOddsPublisher';

async function newDataSource(): Promise<DataSource> {
  const db = newDb();
  db.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 16.0',
  });
  db.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'betnext',
  });
  const ds: DataSource = db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [OutboxRecord],
    synchronize: false,
  });
  await ds.initialize();
  await ds.synchronize();
  return ds;
}

const betPlaced = (outcomeId: string, stake: number, lockedOdds = 2): string =>
  JSON.stringify({ type: 'BetPlaced', aggregateId: randomUUID(), outcomeId, stake, lockedOdds });

describe('Boucle async Pricing : BetPlaced → relais → recalcul → OddsUpdated (bus en mémoire, sans Redis)', () => {
  let ds: DataSource;
  beforeEach(async () => {
    ds = await newDataSource();
  });
  afterEach(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('shouldRelayBetPlacedAndPublishRecalculatedOddsUpdated_WhenRelayingPendingOutbox', async () => {
    // Given
    const repo = ds.getRepository(OutboxRecord);
    await repo.insert({ id: randomUUID(), type: 'BetPlaced', payload: betPlaced('A', 10) });
    await repo.insert({ id: randomUUID(), type: 'BetPlaced', payload: betPlaced('B', 30) });

    const bus = new InMemoryEventBus();
    const oddsSeen: OutboxMessage[] = [];
    bus.subscribe(ODDS_QUEUE, async (m) => {
      oddsSeen.push(m);
    });
    const recalc = new RecalculateOddsOnBetPlaced(
      new InMemoryPricingStore(),
      new OddsCalculator(),
      new QueueOddsPublisher(bus.publisherFor(ODDS_QUEUE)),
    );
    bus.subscribe(DOMAIN_EVENTS_QUEUE, async (m) => {
      const event = JSON.parse(m.payload) as { type: string; outcomeId: string; stake: number };
      if (event.type === 'BetPlaced') {
        await recalc.handle({
          messageId: m.id,
          outcomeId: event.outcomeId,
          stake: Number(event.stake),
        });
      }
    });

    // When
    const published = await new OutboxRelay(
      ds,
      bus.publisherFor(DOMAIN_EVENTS_QUEUE),
    ).publishPending();

    // Then
    expect(published).toBe(2);
    expect(oddsSeen).toHaveLength(2);
    const last = JSON.parse(oddsSeen[oddsSeen.length - 1].payload) as {
      updates: { outcomeId: string; odds: number }[];
    };
    expect(last.updates.find((u) => u.outcomeId === 'A')?.odds).toBeCloseTo(4, 2);
    expect((JSON.parse(betPlaced('A', 10)) as { lockedOdds: number }).lockedOdds).toBe(2);
  });

  it('shouldPublishWithoutLoss_WhenPricingIsDownWithNoSubscribers', async () => {
    // Given
    const repo = ds.getRepository(OutboxRecord);
    await repo.insert({ id: randomUUID(), type: 'BetPlaced', payload: betPlaced('A', 10) });
    const bus = new InMemoryEventBus();

    // When
    const published = await new OutboxRelay(
      ds,
      bus.publisherFor(DOMAIN_EVENTS_QUEUE),
    ).publishPending();

    // Then
    expect(published).toBe(1);
    expect(await repo.count()).toBe(1);
  });
});
