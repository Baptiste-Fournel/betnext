import { SettlementStrategyFactory } from './SettlementStrategyFactory';
import { WINNING_OUTCOME_STRATEGY } from '../domain/settlement/WinningOutcomeStrategy';
import { DomainError } from '../../../shared-kernel/domain/DomainError';

describe('SettlementStrategyFactory (couture polymorphe — ajouter un type sans réécrire)', () => {
  it('résout la stratégie par défaut (WinningOutcomeStrategy enregistrée)', () => {
    const strategy = new SettlementStrategyFactory().resolve();
    expect(strategy.key).toBe(WINNING_OUTCOME_STRATEGY);
  });

  it('clé inconnue → échec explicite (le règlement ne devine pas)', () => {
    expect(() => new SettlementStrategyFactory().resolve('SCORE_EXACT')).toThrow(DomainError);
  });
});
