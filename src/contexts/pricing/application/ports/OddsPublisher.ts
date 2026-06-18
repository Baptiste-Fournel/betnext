export interface OddsUpdate {
  outcomeId: string;
  odds: number;
}

export interface OddsPublisher {
  publish(updates: OddsUpdate[]): Promise<void>;
}
