export const ODDS_READ_MODEL = Symbol('OddsReadModel');

export interface OddsView {
  outcomeId: string;
  odds: number;
}

export interface OddsReadModel {
  current(outcomeId: string): Promise<number | null>;
  put(views: OddsView[], occurredAt: number): Promise<void>;
}
