import { OnModuleDestroy } from '@nestjs/common';
import { OddsReadModel, OddsView } from './OddsReadModel';

export interface RedisLike {
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  quit(): Promise<unknown>;
}

const ODDS_KEY = 'readmodel:odds';
const TS_KEY = 'readmodel:odds:ts';

export class RedisOddsReadModel implements OddsReadModel, OnModuleDestroy {
  constructor(private readonly redis: RedisLike) {}

  async current(outcomeId: string): Promise<number | null> {
    const value = await this.redis.hget(ODDS_KEY, outcomeId);
    return value == null ? null : Number(value);
  }

  async put(views: OddsView[], occurredAt: number): Promise<void> {
    for (const view of views) {
      const storedTs = await this.redis.hget(TS_KEY, view.outcomeId);
      if (storedTs != null && occurredAt < Number(storedTs)) {
        continue;
      }
      await this.redis.hset(ODDS_KEY, view.outcomeId, String(view.odds));
      await this.redis.hset(TS_KEY, view.outcomeId, String(occurredAt));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
