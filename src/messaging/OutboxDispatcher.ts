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
import { redisConnectionFromUrl } from './redisConnection';

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
    const connection = redisConnectionFromUrl(redisUrl);
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
