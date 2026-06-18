import { RegisterMarketOnCreated } from './RegisterMarketOnCreated';
import { PricingStore } from './ports/PricingStore';

class FakeStore implements PricingStore {
  private readonly outcomeToMarket = new Map<string, string>();
  private readonly stakes = new Map<string, Map<string, number>>();

  async markProcessed(): Promise<boolean> {
    return true;
  }
  async registerMarket(marketId: string, outcomeIds: string[]): Promise<void> {
    const market = this.stakes.get(marketId) ?? new Map<string, number>();
    for (const outcomeId of outcomeIds) {
      this.outcomeToMarket.set(outcomeId, marketId);
      if (!market.has(outcomeId)) market.set(outcomeId, 0);
    }
    this.stakes.set(marketId, market);
  }
  async marketOf(outcomeId: string): Promise<string | null> {
    return this.outcomeToMarket.get(outcomeId) ?? null;
  }
  async addStake(marketId: string, outcomeId: string, stake: number): Promise<void> {
    const market = this.stakes.get(marketId) ?? new Map<string, number>();
    market.set(outcomeId, (market.get(outcomeId) ?? 0) + stake);
    this.stakes.set(marketId, market);
  }
  async marketStakes(marketId: string): Promise<ReadonlyMap<string, number>> {
    return new Map(this.stakes.get(marketId) ?? new Map<string, number>());
  }
}

describe('RegisterMarketOnCreated (pricing projection of the market composition)', () => {
  it('shouldMapEveryOutcomeToItsMarket_WhenMarketCreated', async () => {
    // Arrange
    const store = new FakeStore();
    const registrar = new RegisterMarketOnCreated(store);

    // Act
    await registrar.handle({ marketId: 'mkt-1', outcomeIds: ['A', 'B', 'draw'] });

    // Assert
    expect(await store.marketOf('A')).toBe('mkt-1');
    expect(await store.marketOf('draw')).toBe('mkt-1');
    expect([...(await store.marketStakes('mkt-1')).keys()].sort()).toEqual(['A', 'B', 'draw']);
  });

  it('shouldSeedEveryOutcomeAtZeroStake_WhenMarketCreated', async () => {
    // Arrange
    const store = new FakeStore();
    const registrar = new RegisterMarketOnCreated(store);

    // Act
    await registrar.handle({ marketId: 'mkt-1', outcomeIds: ['A', 'B'] });

    // Assert
    const stakes = await store.marketStakes('mkt-1');
    expect(stakes.get('A')).toBe(0);
    expect(stakes.get('B')).toBe(0);
  });

  it('shouldPreserveExistingStakes_WhenSameMarketRegisteredAgain', async () => {
    // Arrange
    const store = new FakeStore();
    const registrar = new RegisterMarketOnCreated(store);
    await registrar.handle({ marketId: 'mkt-1', outcomeIds: ['A', 'B'] });
    await store.addStake('mkt-1', 'A', 25);

    // Act
    await registrar.handle({ marketId: 'mkt-1', outcomeIds: ['A', 'B'] });

    // Assert
    expect((await store.marketStakes('mkt-1')).get('A')).toBe(25);
  });
});
