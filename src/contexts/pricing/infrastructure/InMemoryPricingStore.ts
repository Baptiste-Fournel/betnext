import { PricingStore } from '../application/ports/PricingStore';

/** État Pricing en mémoire : mono-process (POC/tests). Le scale-out réel passe par RedisPricingStore. */
export class InMemoryPricingStore implements PricingStore {
  private readonly processed = new Set<string>();
  private readonly stakes = new Map<string, number>();

  async markProcessed(messageId: string): Promise<boolean> {
    if (this.processed.has(messageId)) {
      return false;
    }
    this.processed.add(messageId);
    return true;
  }

  async add(outcomeId: string, stake: number): Promise<void> {
    this.stakes.set(outcomeId, (this.stakes.get(outcomeId) ?? 0) + stake);
  }

  async totals(): Promise<ReadonlyMap<string, number>> {
    return new Map(this.stakes);
  }
}
