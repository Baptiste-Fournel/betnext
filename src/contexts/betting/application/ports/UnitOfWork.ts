/**
 * COUTURE BET-5 (atomicité débit wallet + pari + événements). Port ORM-agnostique : BET-5
 * enveloppera plusieurs écritures dans une seule transaction via `withTransaction`.
 * NON câblé dans PlaceBet à ce stade (préparation uniquement).
 */
export const UNIT_OF_WORK = Symbol('UnitOfWork');

export interface UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}
