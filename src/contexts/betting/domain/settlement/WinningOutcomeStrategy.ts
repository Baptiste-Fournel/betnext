import { Bet } from '../Bet';
import { MarketResult, SettlementDecision, SettlementStrategy } from './SettlementStrategy';

export const WINNING_OUTCOME_STRATEGY = 'WINNING_OUTCOME';

export class WinningOutcomeStrategy implements SettlementStrategy {
  readonly key = WINNING_OUTCOME_STRATEGY;

  decide(bet: Bet, result: MarketResult): SettlementDecision {
    if (result.voided) {
      return { kind: 'VOID', payout: bet.stake };
    }
    if (bet.outcomeId === result.winningOutcomeId) {
      return { kind: 'WON', payout: bet.potentialGain };
    }
    return { kind: 'LOST', payout: 0 };
  }
}
