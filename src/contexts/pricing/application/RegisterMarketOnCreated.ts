import { PricingStore } from './ports/PricingStore';

export interface MarketCreatedMessage {
  marketId: string;
  outcomeIds: string[];
}

export class RegisterMarketOnCreated {
  constructor(private readonly store: PricingStore) {}

  async handle(message: MarketCreatedMessage): Promise<void> {
    await this.store.registerMarket(message.marketId, message.outcomeIds);
  }
}
