/**
 * Contrat PARTAGÉ (Shared Kernel) pour RÉGLER un marché depuis un autre contexte, SANS importer
 * l'intérieur de Betting. Betting fournit l'implémentation (au-dessus de la couture SettleMarket /
 * BET-12 : exactement-une-fois, idempotent) ; Game Integration le consomme. « Ready-to-split ».
 */
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
