import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';
import { DataType, newDb } from 'pg-mem';
import { OutboxRelay } from './OutboxRelay';
import { OutboxMessage, QueuePort } from './QueuePort';
import { OutboxRecord } from '../contexts/betting/infrastructure/persistence/OutboxRecord';

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

class RecordingQueue implements QueuePort {
  readonly enqueued: OutboxMessage[] = [];
  async enqueue(message: OutboxMessage): Promise<void> {
    this.enqueued.push(message);
  }
}
class FailingQueue implements QueuePort {
  async enqueue(): Promise<void> {
    throw new Error('redis down');
  }
}
class FlakyQueue implements QueuePort {
  calls = 0;
  readonly enqueued: OutboxMessage[] = [];
  async enqueue(message: OutboxMessage): Promise<void> {
    this.calls += 1;
    if (this.calls === 1) throw new Error('redis blip');
    this.enqueued.push(message);
  }
}

describe('OutboxRelay', () => {
  let ds: DataSource;

  beforeEach(async () => {
    ds = await newDataSource();
  });
  afterEach(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  async function seed(n: number): Promise<void> {
    const repo = ds.getRepository(OutboxRecord);
    for (let i = 0; i < n; i += 1) {
      await repo.insert({ id: randomUUID(), type: 'BetPlaced', payload: '{}' });
    }
  }
  const unpublished = (): Promise<number> =>
    ds.getRepository(OutboxRecord).count({ where: { publishedAt: IsNull() } });

  it('shouldEnqueueThenMarkPublished_WhenPendingMessagesExist', async () => {
    // Arrange
    await seed(2);
    const queue = new RecordingQueue();

    // Act
    const published = await new OutboxRelay(ds, queue).publishPending();

    // Assert
    expect(published).toBe(2);
    expect(queue.enqueued).toHaveLength(2);
    expect(await unpublished()).toBe(0);
  });

  it('shouldPublishNoneAndKeepAllForReplay_WhenEveryEnqueueFails', async () => {
    // Arrange
    await seed(2);

    // Act
    const published = await new OutboxRelay(ds, new FailingQueue()).publishPending();

    // Assert
    expect(published).toBe(0);
    expect(await unpublished()).toBe(2);
  });

  it('shouldNotBlockOthers_WhenOnePoisonedRowFails', async () => {
    // Arrange
    await seed(2);
    const queue = new FlakyQueue();

    // Act
    const published = await new OutboxRelay(ds, queue).publishPending();

    // Assert
    expect(published).toBe(1);
    expect(queue.enqueued).toHaveLength(1);
    expect(await unpublished()).toBe(1);
  });
});
