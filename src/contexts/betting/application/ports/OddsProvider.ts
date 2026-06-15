import { Odds } from '../../../../shared-kernel/domain/Odds';

export interface CurrentOdds {
  value: Odds;
  /** true si la cote vient du défaut d'OUVERTURE (read-model froid), pas encore d'un calcul Pricing. */
  provisional: boolean;
}

/** Port de lecture de la cote courante (alimenté par le read-model — ADR-002/006). */
export interface OddsProvider {
  currentOdds(outcomeId: string): Promise<CurrentOdds>;
}
