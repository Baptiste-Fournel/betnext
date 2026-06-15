import { OddsReadModel, OddsView } from './OddsReadModel';

/** Read-model en mémoire (mode sans REDIS_URL / tests). Garde monotone par `occurredAt`. */
export class InMemoryOddsReadModel implements OddsReadModel {
  private readonly odds = new Map<string, { odds: number; ts: number }>();

  async current(outcomeId: string): Promise<number | null> {
    const entry = this.odds.get(outcomeId);
    return entry ? entry.odds : null;
  }

  async put(views: OddsView[], occurredAt: number): Promise<void> {
    for (const view of views) {
      const prev = this.odds.get(view.outcomeId);
      if (!prev || occurredAt >= prev.ts) {
        this.odds.set(view.outcomeId, { odds: view.odds, ts: occurredAt });
      }
    }
  }
}
