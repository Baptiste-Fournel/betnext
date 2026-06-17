export const ODDS_PUBLISHER = Symbol('OddsPublisher');

export interface OddsUpdate {
  outcomeId: string;
  odds: number;
}

export interface OddsPublisher {
  publish(updates: OddsUpdate[]): Promise<void>;
}
