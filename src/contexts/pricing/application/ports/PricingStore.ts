export const PRICING_STORE = Symbol('PricingStore');

export interface PricingStore {
  markProcessed(messageId: string): Promise<boolean>;
  add(outcomeId: string, stake: number): Promise<void>;
  totals(): Promise<ReadonlyMap<string, number>>;
}
