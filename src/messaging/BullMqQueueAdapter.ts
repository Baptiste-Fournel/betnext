import { Queue } from 'bullmq';
import { OutboxMessage, QueuePort } from './QueuePort';

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
