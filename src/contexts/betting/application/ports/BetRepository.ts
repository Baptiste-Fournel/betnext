import { Bet } from '../../domain/Bet';

export const BET_REPOSITORY = Symbol('BetRepository');

export interface StoredBetEvent {
  seq: number;
  betId: string;
  type: string;
  version: number;
  payload: unknown;
  occurredAt: Date;
}

export interface BetRepository {
  save(bet: Bet): Promise<void>;
  findById(id: string): Promise<Bet | null>;
  list(): Promise<Bet[]>;
  listByUser(userId: string): Promise<Bet[]>;
  findPendingByOutcomes(outcomeIds: string[]): Promise<Bet[]>;
  history(betId: string): Promise<StoredBetEvent[]>;
}
