import { OddsCalculator } from '../domain/OddsCalculator';
import { RecalculateOddsOnBetPlaced } from './RecalculateOddsOnBetPlaced';
import { OddsPublisher, OddsUpdate } from './ports/OddsPublisher';
import { PricingStore } from './ports/PricingStore';

/** Doubles inline (la couche application ne dépend pas d'un adapter d'infrastructure — frontière). */
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

describe('RecalculateOddsOnBetPlaced (recalcul async hors chemin d écriture)', () => {
  it('accumule les totaux par issue et publie une cote pari-mutuel bornée à chaque BetPlaced', async () => {
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(new FakeStore(), new OddsCalculator(), publisher);

    await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });
    const updates = await recalc.handle({ messageId: 'm2', outcomeId: 'B', stake: 30 });

    // total misé 40 → A = 40/10 = 4.00 ; B = 40/30 = 1.33 (dans [1.10, 5.00])
    expect(updates?.find((u) => u.outcomeId === 'A')?.odds).toBeCloseTo(4, 2);
    expect(updates?.find((u) => u.outcomeId === 'B')?.odds).toBeCloseTo(1.33, 2);
    expect(publisher.published).toHaveLength(2);
  });

  it('idempotent : même messageId rejoué (re-livraison) → no-op, jamais de double comptage', async () => {
    const publisher = new RecordingPublisher();
    const recalc = new RecalculateOddsOnBetPlaced(new FakeStore(), new OddsCalculator(), publisher);

    const first = await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });
    const second = await recalc.handle({ messageId: 'm1', outcomeId: 'A', stake: 10 });

    expect(first).not.toBeNull();
    expect(second).toBeNull(); // 2e livraison du même message ignorée
    expect(publisher.published).toHaveLength(1); // publié une seule fois → totaux non doublés
  });
});
