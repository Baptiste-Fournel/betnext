import { Queue } from 'bullmq';
import { OutboxMessage, QueuePort } from './QueuePort';

/**
 * Adapter BullMQ du port de file. `jobId = id de la ligne outbox` → dé-doublonnage BullMQ, mais
 * c'est une fenêtre BORNÉE (removeOnComplete) : le garant PÉRENNE de l'idempotence est la table
 * `processed_messages` côté consommateur. Rétention bornée pour ne pas faire grossir Redis.
 */
export class BullMqQueueAdapter implements QueuePort {
  constructor(private readonly queue: Queue) {}

  async enqueue(message: OutboxMessage): Promise<void> {
    await this.queue.add(
      message.type,
      { id: message.id, payload: message.payload },
      { jobId: message.id, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } },
    );
  }
}
