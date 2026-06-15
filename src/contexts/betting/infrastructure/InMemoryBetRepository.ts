import { Bet } from '../domain/Bet';
import { BetRepository } from '../application/ports/BetRepository';

/** Adapter de démarrage / tests. Remplacé par un adapter Postgres en production (ADR-003/005). */
export class InMemoryBetRepository implements BetRepository {
  private readonly store = new Map<string, Bet>();

  async save(bet: Bet): Promise<void> {
    this.store.set(bet.id, bet);
  }

  async findById(id: string): Promise<Bet | null> {
    return this.store.get(id) ?? null;
  }
}
