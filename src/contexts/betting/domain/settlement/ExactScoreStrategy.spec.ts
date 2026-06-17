import { Bet } from '../Bet';
import { Odds } from '../../../../shared-kernel/domain/Odds';
import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { EXACT_SCORE_STRATEGY, ExactScoreStrategy } from './ExactScoreStrategy';

const bet = (outcomeId: string): Bet =>
  Bet.place({ id: 'b1', userId: 'u1', outcomeId, stake: 20, currentOdds: Odds.of(2) });

describe('ExactScoreStrategy (nouveau type de pari ajouté via la couture — BET-25)', () => {
  const strategy = new ExactScoreStrategy();

  it('shouldExposeTheExactScoreKey_WhenRegisteredInTheFactory', () => {
    // Act / Assert — la clé sert d'enregistrement (betting.module.ts), sans toucher l'existant
    expect(strategy.key).toBe(EXACT_SCORE_STRATEGY);
  });

  it('shouldDecideWonPaidAtLockedOdds_WhenScorelineIsExact', () => {
    // Act / Assert
    expect(strategy.decide(bet('2-1'), { winningOutcomeId: '2-1', voided: false })).toEqual({
      kind: 'WON',
      payout: 40,
    });
  });

  it('shouldDecideLostWithNoPayout_WhenScorelineIsWrong', () => {
    // Act / Assert
    expect(strategy.decide(bet('1-0'), { winningOutcomeId: '2-1', voided: false })).toEqual({
      kind: 'LOST',
      payout: 0,
    });
  });

  it('shouldDecideVoidRefundingExactStake_WhenMatchIsVoided', () => {
    // Act / Assert
    expect(strategy.decide(bet('2-1'), { winningOutcomeId: null, voided: true })).toEqual({
      kind: 'VOID',
      payout: 20,
    });
  });

  it('shouldThrowDomainErrorNeverLosingSilently_WhenNoWinningScorelineButNotVoided', () => {
    // Act / Assert — money-safe : pas de score concret = erreur de donnée, jamais « tout LOST »
    expect(() => strategy.decide(bet('2-1'), { winningOutcomeId: null, voided: false })).toThrow(
      DomainError,
    );
  });
});
