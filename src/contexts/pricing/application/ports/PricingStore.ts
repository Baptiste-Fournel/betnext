export interface PricingStore {
  markProcessed(messageId: string): Promise<boolean>;
  registerMarket(marketId: string, outcomeIds: string[]): Promise<void>;
  marketOf(outcomeId: string): Promise<string | null>;
  addStake(marketId: string, outcomeId: string, stake: number): Promise<void>;
  marketStakes(marketId: string): Promise<ReadonlyMap<string, number>>;
}
