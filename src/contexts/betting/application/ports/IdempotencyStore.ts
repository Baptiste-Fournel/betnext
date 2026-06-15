export const IDEMPOTENCY_STORE = Symbol('IdempotencyStore');

export interface IdempotencyEntry {
  requestHash: string;
  betId: string | null;
  lockedOdds: number | null;
  potentialGain: number | null;
}

export type ClaimOutcome = { claimed: true } | { claimed: false; existing: IdempotencyEntry };

export interface PlaceBetResult {
  betId: string;
  lockedOdds: number;
  potentialGain: number;
}

/**
 * Réservation atomique d'une clé d'idempotence + stockage du résultat. `claim` doit être
 * concurrent-safe (contrainte d'unicité). `release` libère une clé réservée dont l'opération a
 * échoué (pour ne pas « brûler » la clé sur un retry corrigé) ; sur Postgres le rollback de la
 * transaction l'annule de toute façon, `release` est surtout utile en mode sans transaction.
 * Opère dans la transaction ambiante (même tx que le pari).
 */
export interface IdempotencyStore {
  claim(key: string, requestHash: string): Promise<ClaimOutcome>;
  complete(key: string, result: PlaceBetResult): Promise<void>;
  release(key: string): Promise<void>;
}
