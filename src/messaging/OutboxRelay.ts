import { DataSource, IsNull } from 'typeorm';
import { OutboxRecord } from '../contexts/betting/infrastructure/persistence/OutboxRecord';
import { QueuePort } from './QueuePort';

/**
 * Relais Transactional Outbox (ADR-008). Poll les lignes non publiées et les met en file. Une
 * ligne n'est marquée « publiée » qu'APRÈS un enqueue réussi (rejeu sinon → at-least-once, aucune
 * perte). Un enqueue en échec NE BLOQUE PAS le reste du lot (pas de head-of-line blocking) : la
 * ligne reste non publiée et sera retentée au prochain passage.
 */
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
        continue; // laissée non publiée → rejeu au prochain passage ; n'empêche pas les autres lignes
      }
      await repo.update({ id: row.id }, { publishedAt: new Date() });
      published += 1;
    }
    return published;
  }
}
