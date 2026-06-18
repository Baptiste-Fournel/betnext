import { PricingStore } from '../application/ports/PricingStore';

export class InMemoryPricingStore implements PricingStore {
  private readonly processed = new Set<string>();
  private readonly outcomeToMarket = new Map<string, string>();
  private readonly stakesByMarket = new Map<string, Map<string, number>>();

  async markProcessed(messageId: string): Promise<boolean> {
    if (this.processed.has(messageId)) {
      return false;
    }
    this.processed.add(messageId);
    return true;
  }

  async registerMarket(marketId: string, outcomeIds: string[]): Promise<void> {
    const stakes = this.stakesByMarket.get(marketId) ?? new Map<string, number>();
    for (const outcomeId of outcomeIds) {
      this.outcomeToMarket.set(outcomeId, marketId);
      if (!stakes.has(outcomeId)) {
        stakes.set(outcomeId, 0);
      }
    }
    this.stakesByMarket.set(marketId, stakes);
  }

  async marketOf(outcomeId: string): Promise<string | null> {
    return this.outcomeToMarket.get(outcomeId) ?? null;
  }

  async addStake(marketId: string, outcomeId: string, stake: number): Promise<void> {
    const stakes = this.stakesByMarket.get(marketId) ?? new Map<string, number>();
    stakes.set(outcomeId, (stakes.get(outcomeId) ?? 0) + stake);
    this.stakesByMarket.set(marketId, stakes);
  }

  async marketStakes(marketId: string): Promise<ReadonlyMap<string, number>> {
    return new Map(this.stakesByMarket.get(marketId) ?? new Map<string, number>());
  }
}
