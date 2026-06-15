import {
  ClaimOutcome,
  IdempotencyEntry,
  IdempotencyStore,
  PlaceBetResult,
} from '../application/ports/IdempotencyStore';

/** Store en mémoire (mode sans DATABASE_URL). La concurrence réelle est prouvée sur Postgres. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, IdempotencyEntry>();

  async claim(key: string, requestHash: string): Promise<ClaimOutcome> {
    const existing = this.store.get(key);
    if (existing) {
      return { claimed: false, existing };
    }
    this.store.set(key, { requestHash, betId: null, lockedOdds: null, potentialGain: null });
    return { claimed: true };
  }

  async complete(key: string, result: PlaceBetResult): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.betId = result.betId;
      entry.lockedOdds = result.lockedOdds;
      entry.potentialGain = result.potentialGain;
    }
  }

  async release(key: string): Promise<void> {
    this.store.delete(key);
  }
}
