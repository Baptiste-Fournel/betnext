import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { OutboxRelay } from './OutboxRelay';
import { BullMqQueueAdapter } from './BullMqQueueAdapter';
import { DOMAIN_EVENTS_QUEUE } from './topics';

/**
 * Câble le relais Outbox dans le BOOT réel du monolithe (comble le trou laissé par BET-7) : un
 * poll périodique vide l'outbox vers le bus tant que l'app tourne — les events circulent vraiment,
 * pas seulement en test. Actif uniquement si DATABASE_URL (outbox) ET REDIS_URL (bus) sont définis ;
 * sinon inerte (mode POC/tests en mémoire). At-least-once (publié après enqueue) ; ticks non chevauchés.
 */
@Injectable()
export class OutboxDispatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: ReturnType<typeof setInterval>;
  private queue?: Queue;
  private running = false;

  constructor(@Optional() @Inject(getDataSourceToken()) private readonly dataSource?: DataSource) {}

  onApplicationBootstrap(): void {
    const redisUrl = process.env.REDIS_URL;
    if (!this.dataSource || !redisUrl) {
      this.logger.log('OutboxDispatcher inerte (DATABASE_URL/REDIS_URL absent) — mode sans bus.');
      return;
    }
    const url = new URL(redisUrl);
    const connection = { host: url.hostname, port: Number(url.port || 6379) };
    this.queue = new Queue(DOMAIN_EVENTS_QUEUE, { connection });
    const relay = new OutboxRelay(this.dataSource, new BullMqQueueAdapter(this.queue));
    const intervalMs = Number(process.env.OUTBOX_POLL_MS ?? 500);
    this.timer = setInterval(() => void this.tick(relay), intervalMs);
    this.logger.log(`Relais Outbox actif (poll ${intervalMs}ms → ${DOMAIN_EVENTS_QUEUE}).`);
  }

  private async tick(relay: OutboxRelay): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await relay.publishPending();
    } catch (error) {
      this.logger.error('Échec du relais Outbox (rejeu au prochain tick).', error as Error);
    } finally {
      this.running = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
