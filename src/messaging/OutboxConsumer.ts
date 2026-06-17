import { Job, Worker } from 'bullmq';
import { EntityManager } from 'typeorm';
import { IdempotentMessageHandler } from './IdempotentMessageHandler';

export interface RedisConnection {
  host: string;
  port: number;
}

export class OutboxConsumer {
  constructor(
    private readonly queueName: string,
    private readonly connection: RedisConnection,
    private readonly handler: IdempotentMessageHandler,
    private readonly effect: (manager: EntityManager, job: Job) => Promise<void> = async () => {},
  ) {}

  start(): Worker {
    return new Worker(
      this.queueName,
      async (job: Job) => {
        const messageId = job.data.id as string;
        await this.handler.handle(messageId, (manager) => this.effect(manager, job));
      },
      { connection: this.connection },
    );
  }
}
