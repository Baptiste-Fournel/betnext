import { Job, Worker } from 'bullmq';
import { EntityManager } from 'typeorm';
import { IdempotentMessageHandler } from './IdempotentMessageHandler';

export interface RedisConnection {
  host: string;
  port: number;
}

/**
 * Consommateur de la file (BullMQ Worker). Chaque job est traité IDEMPOTEMMENT (dé-doublonnage
 * par id d'event). L'« effet » métier est injecté (placeholder ici ; une vraie projection
 * read-model arrivera en BET-10). NB : idempotence du CONSOMMATEUR (events) ≠ idempotence HTTP
 * côté client (header Idempotency-Key, fenêtre de double-débit au retry) qui reste BET-8.
 */
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
