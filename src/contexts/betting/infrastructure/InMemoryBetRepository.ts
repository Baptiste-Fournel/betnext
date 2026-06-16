import { Bet } from '../domain/Bet';
import { BetStatus } from '../domain/BetStatus';
import { BetRepository, StoredBetEvent } from '../application/ports/BetRepository';

/**
 * Adapter en mémoire (dev / tests / mode sans DATABASE_URL). Respecte la même sémantique que
 * l'adapter Postgres : snapshot autoritatif + journal append-only (insertions uniquement).
 */
export class InMemoryBetRepository implements BetRepository {
  private readonly snapshots = new Map<string, Bet>();
  private readonly events: StoredBetEvent[] = [];
  private seq = 0;

  async save(bet: Bet): Promise<void> {
    this.snapshots.set(bet.id, bet);
    for (const event of bet.pullEvents()) {
      this.events.push({
        seq: ++this.seq,
        betId: bet.id,
        type: event.type,
        version: 1,
        payload: { ...event },
        occurredAt: event.occurredAt,
      });
    }
  }

  async findById(id: string): Promise<Bet | null> {
    return this.snapshots.get(id) ?? null;
  }

  async findPendingByOutcomes(outcomeIds: string[]): Promise<Bet[]> {
    const wanted = new Set(outcomeIds);
    return [...this.snapshots.values()].filter(
      (bet) => bet.status === BetStatus.Pending && wanted.has(bet.outcomeId),
    );
  }

  async history(betId: string): Promise<StoredBetEvent[]> {
    return this.events.filter((e) => e.betId === betId).sort((a, b) => a.seq - b.seq);
  }
}
