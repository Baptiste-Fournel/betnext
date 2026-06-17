import { DataSource, IsNull } from 'typeorm';
import { OutboxRecord } from '../contexts/betting/infrastructure/persistence/OutboxRecord';
import { QueuePort } from './QueuePort';

export class OutboxRelay {
  constructor(
    private readonly dataSource: DataSource,
    private readonly queue: QueuePort,
  ) {}

  async publishPending(batchSize = 100): Promise<number> {
    const repo = this.dataSource.getRepository(OutboxRecord);
    const pending = await repo.find({
      where: { publishedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: batchSize,
    });
    let published = 0;
    for (const row of pending) {
      try {
        await this.queue.enqueue({ id: row.id, type: row.type, payload: row.payload });
      } catch {
        continue;
      }
      await repo.update({ id: row.id }, { publishedAt: new Date() });
      published += 1;
    }
    return published;
  }
}
