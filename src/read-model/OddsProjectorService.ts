import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { ODDS_READ_MODEL, OddsReadModel } from './OddsReadModel';
import { ODDS_QUEUE } from '../messaging/topics';

/**
 * Projection câblée au BOOT : consomme OddsUpdated (file odds, publiée par Pricing) et met à jour
 * le read-model. Maillon qui rend la cote async VISIBLE en lecture. Worker en `concurrency: 1`
 * (ordre FIFO par file) + garde monotone `occurredAt` côté read-model → pas de cote durablement
 * fausse sous réordonnancement/retry. Actif si REDIS_URL ; sinon inerte (tests projettent en direct).
 */
@Injectable()
export class OddsProjectorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OddsProjectorService.name);
  private worker?: Worker;

  constructor(@Inject(ODDS_READ_MODEL) private readonly readModel: OddsReadModel) {}

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
        const payload = JSON.parse(job.data.payload as string) as {
          type: string;
          occurredAt?: string;
          updates: { outcomeId: string; odds: number }[];
        };
        if (payload.type !== 'OddsUpdated') {
          return;
        }
        const parsed = payload.occurredAt ? Date.parse(payload.occurredAt) : Date.now();
        await this.readModel.put(payload.updates, Number.isNaN(parsed) ? Date.now() : parsed);
      },
      { connection, concurrency: 1 },
    );
    this.logger.log(`Projecteur cotes actif (consomme ${ODDS_QUEUE} → read-model, FIFO).`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
