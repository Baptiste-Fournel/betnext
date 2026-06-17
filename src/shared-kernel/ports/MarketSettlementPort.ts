export const MARKET_SETTLEMENT_PORT = Symbol('MarketSettlementPort');

export interface SettlementRequest {
  outcomes: string[];
  winningOutcomeId: string | null;
  voided: boolean;
}

export interface SettlementSummary {
  settled: number;
  won: number;
  lost: number;
  voided: number;
  failed: number;
}

export interface MarketSettlementPort {
  settle(request: SettlementRequest): Promise<SettlementSummary>;
}
