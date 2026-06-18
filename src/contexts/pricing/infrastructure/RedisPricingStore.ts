import { PricingStore } from '../application/ports/PricingStore';

export interface RedisLike {
  sadd(key: string, member: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  hsetnx(key: string, field: string, value: string): Promise<number>;
  hincrbyfloat(key: string, field: string, increment: number | string): Promise<string>;
  hgetall(key: string): Promise<Record<string, string>>;
}

export class RedisPricingStore implements PricingStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'pricing',
  ) {}

  async markProcessed(messageId: string): Promise<boolean> {
    return (await this.redis.sadd(`${this.prefix}:processed`, messageId)) === 1;
  }

  async registerMarket(marketId: string, outcomeIds: string[]): Promise<void> {
    for (const outcomeId of outcomeIds) {
      await this.redis.hset(`${this.prefix}:outcome-market`, outcomeId, marketId);
      await this.redis.hsetnx(`${this.prefix}:stakes:${marketId}`, outcomeId, '0');
    }
  }

  async marketOf(outcomeId: string): Promise<string | null> {
    return this.redis.hget(`${this.prefix}:outcome-market`, outcomeId);
  }

  async addStake(marketId: string, outcomeId: string, stake: number): Promise<void> {
    await this.redis.hincrbyfloat(`${this.prefix}:stakes:${marketId}`, outcomeId, stake);
  }

  async marketStakes(marketId: string): Promise<ReadonlyMap<string, number>> {
    const hash = await this.redis.hgetall(`${this.prefix}:stakes:${marketId}`);
    return new Map(Object.entries(hash).map(([outcomeId, value]) => [outcomeId, Number(value)]));
  }
}
