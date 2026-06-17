import { Bet } from '../../domain/Bet';

/** Jeton d'injection du port (Dependency Inversion). */
export const BET_REPOSITORY = Symbol('BetRepository');

/** Entrée du journal append-only (audit / rejeu — ADR-005). */
export interface StoredBetEvent {
  seq: number;
  betId: string;
  type: string;
  version: number;
  payload: unknown;
  occurredAt: Date;
}

/**
 * Port de persistance de l'agrégat Bet (hexagonal : AUCUNE fuite d'ORM ici).
 * `save` persiste le SNAPSHOT (cote figée incluse) + APPEND les nouveaux événements de façon
 * atomique. `findById` relit depuis le snapshot autoritatif — JAMAIS de recalcul de cote.
 */
export interface BetRepository {
  save(bet: Bet): Promise<void>;
  findById(id: string): Promise<Bet | null>;
  /** Liste TOUS les paris (NON scopée — usage interne/admin ; jamais exposée telle quelle en HTTP). */
  list(): Promise<Bet[]>;
  /** Liste les paris d'UN utilisateur (scoping anti-IDOR — BET-20). */
  listByUser(userId: string): Promise<Bet[]>;
  /** Paris EN ATTENTE dont l'issue est dans la liste (sélection des paris d'un marché à régler). */
  findPendingByOutcomes(outcomeIds: string[]): Promise<Bet[]>;
  history(betId: string): Promise<StoredBetEvent[]>;
}
