import { randomUUID } from 'node:crypto';
import { QueuePort } from '../../../messaging/QueuePort';
import { OddsPublisher, OddsUpdate } from '../application/ports/OddsPublisher';

/** Publie OddsUpdated sur le bus (file odds). Implémentation du port de sortie de Pricing. */
export class QueueOddsPublisher implements OddsPublisher {
  constructor(private readonly queue: QueuePort) {}

  async publish(updates: OddsUpdate[]): Promise<void> {
    await this.queue.enqueue({
      id: randomUUID(),
      type: 'OddsUpdated',
      payload: JSON.stringify({
        type: 'OddsUpdated',
        updates,
        occurredAt: new Date().toISOString(),
      }),
    });
  }
}
