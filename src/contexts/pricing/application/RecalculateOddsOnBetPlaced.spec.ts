import { OddsCalculator } from '../domain/OddsCalculator';
import { RecalculateOddsOnBetPlaced } from './RecalculateOddsOnBetPlaced';
import { OddsPublisher, OddsUpdate } from './ports/OddsPublisher';
import { PricingStore } from './ports/PricingStore';

class FakeStore implements PricingStore {
  private readonly processed = new Set<string>();
  private readonly stakes = new Map<string, number>();
  async markProcessed(id: string): Promise<boolean> {
    if (this.processed.has(id)) return false;
    this.processed.add(id);
    return true;
  }
  async add(outcomeId: string, stake: number): Promise<void> {
    this.stakes.set(outcomeId, (this.stakes.get(outcomeId) ?? 0) + stake);
  }
  async totals(): Promise<ReadonlyMap<string, number>> {
    return new Map(this.stakes);
  }
}
class RecordingPublisher implements OddsPublisher {
  readonly published: OddsUpdate[][] = [];
  async publish(updates: OddsUpdate[]): Promise<void> {
    this.published.push(updates);
  }
}

describe('RecalculateOddsOnBetPlaced (async recompute off the write path)', () => {
  it('shouldAccumulateTotalsAndPublishBoundedPariMutuelOdds_WhenBetPlaced', async () => {
    // Arrange
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(new FakeStore(), new OddsCalculator(), publisher);

    // Act
    await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });
    const updates = await recalc.handle({ messageId: 'm2', outcomeId: 'B', stake: 30 });

    // Assert
    expect(updates?.find((u) => u.outcomeId === 'A')?.odds).toBeCloseTo(4, 2);
    expect(updates?.find((u) => u.outcomeId === 'B')?.odds).toBeCloseTo(1.33, 2);
    expect(publisher.published).toHaveLength(2);
  });

  it('shouldNoOpWithoutDoubleCounting_WhenSameMessageIdRedelivered', async () => {
    // Arrange
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(new FakeStore(), new OddsCalculator(), publisher);

    // Act
    const first = await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });
    const second = await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });

    // Assert
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(publisher.published).toHaveLength(1);
  });
});
