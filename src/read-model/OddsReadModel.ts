export const ODDS_READ_MODEL = Symbol('OddsReadModel');

export interface OddsView {
  outcomeId: string;
  odds: number;
}

/**
 * Read-model des cotes COURANTES (ADR-006), côté LECTURE du CQRS. Alimenté par OddsUpdated
 * (projection), lu par le joueur et le chemin de placement — plus jamais la base d'écriture.
 * Redis = cache RECONSTRUCTIBLE, jamais autoritatif. `current` renvoie null tant que la cote n'a
 * pas été projetée (cold cache → latence de cohérence éventuelle OBSERVABLE). `put` reçoit
 * l'horodatage du snapshot (`occurredAt`) → GARDE MONOTONE : un snapshot plus ancien (re-livraison /
 * réordonnancement at-least-once) n'écrase jamais une cote plus récente.
 */
export interface OddsReadModel {
  current(outcomeId: string): Promise<number | null>;
  put(views: OddsView[], occurredAt: number): Promise<void>;
}
