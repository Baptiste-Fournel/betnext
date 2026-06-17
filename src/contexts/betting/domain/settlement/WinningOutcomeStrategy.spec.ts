import { Bet } from '../Bet';
import { Odds } from '../../../../shared-kernel/domain/Odds';
import { WinningOutcomeStrategy } from './WinningOutcomeStrategy';

const bet = (outcomeId: string): Bet =>
  Bet.place({ id: 'b1', userId: 'u1', outcomeId, stake: 20, currentOdds: Odds.of(2) });

describe('WinningOutcomeStrategy (1re vraie stratégie de règlement)', () => {
  const strategy = new WinningOutcomeStrategy();

  it('shouldDecideWonPaidAtLockedOdds_WhenOutcomeWins', () => {
    // Act / Assert
    expect(strategy.decide(bet('A'), { winningOutcomeId: 'A', voided: false })).toEqual({
      kind: 'WON',
      payout: 40,
    });
  });

  it('shouldDecideLostWithNoPayout_WhenAnotherOutcomeWins', () => {
    // Act / Assert
    expect(strategy.decide(bet('A'), { winningOutcomeId: 'B', voided: false })).toEqual({
      kind: 'LOST',
      payout: 0,
    });
  });

  it('shouldDecideVoidRefundingExactStake_WhenMarketVoided', () => {
    // Act / Assert
    expect(strategy.decide(bet('A'), { winningOutcomeId: null, voided: true })).toEqual({
      kind: 'VOID',
      payout: 20,
    });
  });
});
