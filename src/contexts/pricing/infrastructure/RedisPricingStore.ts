import { PricingStore } from '../application/ports/PricingStore';

export interface RedisLike {
  sadd(key: string, member: string): Promise<number>;
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

  async add(outcomeId: string, stake: number): Promise<void> {
    await this.redis.hincrbyfloat(`${this.prefix}:stakes`, outcomeId, stake);
  }

  async totals(): Promise<ReadonlyMap<string, number>> {
    const hash = await this.redis.hgetall(`${this.prefix}:stakes`);
    return new Map(Object.entries(hash).map(([outcomeId, value]) => [outcomeId, Number(value)]));
  }
}
