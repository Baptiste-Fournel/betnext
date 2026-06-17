import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { Bet } from '../Bet';
import { MarketResult, SettlementDecision, SettlementStrategy } from './SettlementStrategy';

export const EXACT_SCORE_STRATEGY = 'EXACT_SCORE';

export class ExactScoreStrategy implements SettlementStrategy {
  readonly key = EXACT_SCORE_STRATEGY;

  decide(bet: Bet, result: MarketResult): SettlementDecision {
    if (result.voided) {
      return { kind: 'VOID', payout: bet.stake };
    }
    if (result.winningOutcomeId === null) {
      throw new DomainError('Score exact : règlement impossible sans grille de score gagnante');
    }
    if (bet.outcomeId === result.winningOutcomeId) {
      return { kind: 'WON', payout: bet.potentialGain };
    }
    return { kind: 'LOST', payout: 0 };
  }
}
