import { Job, Worker } from 'bullmq';
import { RecalculateOddsOnBetPlaced } from '../application/RecalculateOddsOnBetPlaced';

export interface RedisConnection {
  host: string;
  port: number;
}

/**
 * Adapter d'ENTRÉE du service Pricing : Worker BullMQ qui livre les BetPlaced du bus au use case.
 * Filtre par type ; transmet l'id de message (idempotence). Le service ne connaît Betting que par
 * ce contrat JSON (aucun import) → déployable indépendamment.
 */
export class PricingWorker {
  constructor(
    private readonly queueName: string,
    private readonly connection: RedisConnection,
    private readonly recalc: RecalculateOddsOnBetPlaced,
  ) {}

  start(): Worker {
    return new Worker(
      this.queueName,
      async (job: Job) => {
        const messageId = job.data.id as string;
        const payload = JSON.parse(job.data.payload as string) as {
          type: string;
          outcomeId: string;
          stake: number;
        };
        if (payload.type !== 'BetPlaced') {
          return;
        }
        await this.recalc.handle({
          messageId,
          outcomeId: payload.outcomeId,
          stake: Number(payload.stake),
        });
      },
      { connection: this.connection },
    );
  }
}
