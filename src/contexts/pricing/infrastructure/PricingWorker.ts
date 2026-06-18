import { Job, Worker } from 'bullmq';
import { RecalculateOddsOnBetPlaced } from '../application/RecalculateOddsOnBetPlaced';
import { RegisterMarketOnCreated } from '../application/RegisterMarketOnCreated';

export interface RedisConnection {
  host: string;
  port: number;
}

interface DomainEventPayload {
  type: string;
  outcomeId?: string;
  stake?: number;
  marketId?: string;
  outcomeIds?: string[];
}

export class PricingWorker {
  constructor(
    private readonly queueName: string,
    private readonly connection: RedisConnection,
    private readonly recalc: RecalculateOddsOnBetPlaced,
    private readonly registrar: RegisterMarketOnCreated,
  ) {}

  start(): Worker {
    return new Worker(
      this.queueName,
      async (job: Job) => {
        const messageId = job.data.id as string;
        const payload = JSON.parse(job.data.payload as string) as DomainEventPayload;
        if (payload.type === 'MarketCreated' && payload.marketId && payload.outcomeIds) {
          await this.registrar.handle({
            marketId: payload.marketId,
            outcomeIds: payload.outcomeIds,
          });
          return;
        }
        if (payload.type === 'BetPlaced' && payload.outcomeId) {
          await this.recalc.handle({
            messageId,
            outcomeId: payload.outcomeId,
            stake: Number(payload.stake),
          });
        }
      },
      { connection: this.connection, concurrency: 1 },
    );
  }
}
