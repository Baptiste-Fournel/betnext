import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { SettlementStrategy } from '../domain/settlement/SettlementStrategy';
import {
  WINNING_OUTCOME_STRATEGY,
  WinningOutcomeStrategy,
} from '../domain/settlement/WinningOutcomeStrategy';

export class SettlementStrategyFactory {
  private readonly strategies = new Map<string, SettlementStrategy>();

  constructor(strategies: SettlementStrategy[] = [new WinningOutcomeStrategy()]) {
    for (const strategy of strategies) {
      this.strategies.set(strategy.key, strategy);
    }
  }

  resolve(key: string = WINNING_OUTCOME_STRATEGY): SettlementStrategy {
    const strategy = this.strategies.get(key);
    if (!strategy) {
      throw new DomainError(`Aucune stratégie de règlement pour la clé "${key}"`);
    }
    return strategy;
  }
}
