export const ODDS_PUBLISHER = Symbol('OddsPublisher');

export interface OddsUpdate {
  outcomeId: string;
  odds: number;
}

/** Port de SORTIE de Pricing : publie les cotes recalculées (vers le bus → read-model en BET-10). */
export interface OddsPublisher {
  publish(updates: OddsUpdate[]): Promise<void>;
}
