import { Bet } from '../Bet';

export type SettlementKind = 'WON' | 'LOST' | 'VOID' | 'PARTIAL';

export interface MarketResult {
  winningOutcomeId: string | null;
  voided: boolean;
}

export interface SettlementDecision {
  kind: SettlementKind;
  payout: number;
}

export interface SettlementStrategy {
  readonly key: string;
  decide(bet: Bet, result: MarketResult): SettlementDecision;
}
