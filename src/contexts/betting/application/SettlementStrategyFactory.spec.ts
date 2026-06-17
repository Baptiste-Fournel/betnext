import { SettlementStrategyFactory } from './SettlementStrategyFactory';
import { WINNING_OUTCOME_STRATEGY } from '../domain/settlement/WinningOutcomeStrategy';
import { DomainError } from '../../../shared-kernel/domain/DomainError';

describe('SettlementStrategyFactory (polymorphic seam — add a type without rewriting)', () => {
  it('shouldResolveDefaultStrategy_WhenNoKeyProvided', () => {
    // Arrange
    const strategy = new SettlementStrategyFactory().resolve();

    // Assert
    expect(strategy.key).toBe(WINNING_OUTCOME_STRATEGY);
  });

  it('shouldThrowDomainError_WhenKeyUnknown', () => {
    // Act / Assert
    expect(() => new SettlementStrategyFactory().resolve('SCORE_EXACT')).toThrow(DomainError);
  });
});
