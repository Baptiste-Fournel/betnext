import { OddsCalculator } from '../domain/OddsCalculator';
import { Odds } from '../../../shared-kernel/domain/Odds';
import { RecalculateOddsOnBetPlaced } from './RecalculateOddsOnBetPlaced';
import { OddsPublisher, OddsUpdate } from './ports/OddsPublisher';
import { PricingStore } from './ports/PricingStore';

class FakeStore implements PricingStore {
  private readonly processed = new Set<string>();
  private readonly outcomeToMarket = new Map<string, string>();
  private readonly stakes = new Map<string, Map<string, number>>();

  async markProcessed(id: string): Promise<boolean> {
    if (this.processed.has(id)) return false;
    this.processed.add(id);
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
class RecordingPublisher implements OddsPublisher {
  readonly published: OddsUpdate[][] = [];
  async publish(updates: OddsUpdate[]): Promise<void> {
    this.published.push(updates);
  }
}

describe('RecalculateOddsOnBetPlaced (async recompute off the write path)', () => {
  it('shouldRecalculateEveryOutcomeOfTheMarket_WhenBetPlacedOnOneOutcome', async () => {
    // Arrange
    const store = new FakeStore();
    await store.registerMarket('mkt-1', ['A', 'B', 'draw']);
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(store, new OddsCalculator(), publisher);

    // Act
    await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });
    const updates = await recalc.handle({ messageId: 'm2', outcomeId: 'B', stake: 30 });

    // Assert
    expect(updates?.find((u) => u.outcomeId === 'A')?.odds).toBeCloseTo(4, 2);
    expect(updates?.find((u) => u.outcomeId === 'B')?.odds).toBeCloseTo(1.33, 2);
    expect(updates?.find((u) => u.outcomeId === 'draw')?.odds).toBe(Odds.MAX);
  });

  it('shouldIsolateOddsPerMarket_WhenTwoMarketsAreActive', async () => {
    // Arrange
    const store = new FakeStore();
    await store.registerMarket('mkt-1', ['A', 'B']);
    await store.registerMarket('mkt-2', ['X', 'Y']);
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(store, new OddsCalculator(), publisher);

    // Act
    await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 1000 });
    const updates = await recalc.handle({ messageId: 'm2', outcomeId: 'X', stake: 10 });

    // Assert
    expect(updates?.map((u) => u.outcomeId).sort()).toEqual(['X', 'Y']);
    expect(updates?.find((u) => u.outcomeId === 'X')?.odds).toBe(Odds.MIN);
    expect(updates?.find((u) => u.outcomeId === 'Y')?.odds).toBe(Odds.MAX);
  });

  it('shouldIgnoreBet_WhenMarketIsUnknown', async () => {
    // Arrange
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(new FakeStore(), new OddsCalculator(), publisher);

    // Act
    const updates = await recalc.handle({ messageId: 'm1', outcomeId: 'orphan', stake: 10 });

    // Assert
    expect(updates).toBeNull();
    expect(publisher.published).toHaveLength(0);
  });

  it('shouldNoOpWithoutDoubleCounting_WhenSameMessageIdRedelivered', async () => {
    // Arrange
    const store = new FakeStore();
    await store.registerMarket('mkt-1', ['A', 'B']);
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(store, new OddsCalculator(), publisher);

    // Act
    const first = await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });
    const second = await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });

    // Assert
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(publisher.published).toHaveLength(1);
  });
});
