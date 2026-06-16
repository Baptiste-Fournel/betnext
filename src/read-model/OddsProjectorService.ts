import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { ODDS_READ_MODEL, OddsReadModel } from './OddsReadModel';
import { OddsLiveEvent, OddsStream } from './OddsStream';
import { ODDS_QUEUE } from '../messaging/topics';

interface OddsUpdatedPayload {
  type: string;
  occurredAt?: string;
  updates: OddsLiveEvent[];
}

/**
 * Projection câblée au BOOT : consomme OddsUpdated (file odds, publiée par Pricing), met à jour le
 * read-model (garde monotone, FIFO) PUIS pousse chaque cote sur le flux live (SSE — incrément 3).
 * Le flux SSE est donc alimenté par le VRAI event OddsUpdated, pas par du polling. Actif si
 * REDIS_URL ; sinon inerte (les tests appellent `project()` directement).
 */
@Injectable()
export class OddsProjectorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OddsProjectorService.name);
  private worker?: Worker;

  constructor(
    @Inject(ODDS_READ_MODEL) private readonly readModel: OddsReadModel,
    private readonly stream: OddsStream,
  ) {}

  /** Cœur testable : OddsUpdated → read-model + flux live (mêmes données, une seule source). */
  async project(payload: OddsUpdatedPayload): Promise<void> {
    if (payload.type !== 'OddsUpdated') {
      return;
    }
    const parsed = payload.occurredAt ? Date.parse(payload.occurredAt) : Date.now();
    await this.readModel.put(payload.updates, Number.isNaN(parsed) ? Date.now() : parsed);
    for (const update of payload.updates) {
      this.stream.publish({ outcomeId: update.outcomeId, odds: update.odds });
    }
  }

  onApplicationBootstrap(): void {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.log('Projecteur cotes inerte (REDIS_URL absent) — mode sans bus.');
      return;
    }
    const url = new URL(redisUrl);
    const connection = { host: url.hostname, port: Number(url.port || 6379) };
    this.worker = new Worker(
      ODDS_QUEUE,
      async (job: Job) => {
        await this.project(JSON.parse(job.data.payload as string) as OddsUpdatedPayload);
      },
      { connection, concurrency: 1 },
    );
    this.logger.log(
      `Projecteur cotes actif (consomme ${ODDS_QUEUE} → read-model + flux SSE, FIFO).`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
