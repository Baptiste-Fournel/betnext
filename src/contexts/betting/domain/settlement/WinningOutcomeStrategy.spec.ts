import { Bet } from '../Bet';
import { Odds } from '../../../../shared-kernel/domain/Odds';
import { WinningOutcomeStrategy } from './WinningOutcomeStrategy';

const bet = (outcomeId: string): Bet =>
  Bet.place({ id: 'b1', userId: 'u1', outcomeId, stake: 20, currentOdds: Odds.of(2) });

describe('WinningOutcomeStrategy (1re vraie stratégie de règlement)', () => {
  const strategy = new WinningOutcomeStrategy();

  it('issue gagnante → WON, payé à la cote figée (potentialGain)', () => {
    expect(strategy.decide(bet('A'), { winningOutcomeId: 'A', voided: false })).toEqual({
      kind: 'WON',
      payout: 40, // 20 × 2 (cote figée)
    });
  });

  it('autre issue → LOST, aucun paiement', () => {
    expect(strategy.decide(bet('A'), { winningOutcomeId: 'B', voided: false })).toEqual({
      kind: 'LOST',
      payout: 0,
    });
  });

  it('marché annulé → VOID, remboursement EXACT de la mise', () => {
    expect(strategy.decide(bet('A'), { winningOutcomeId: null, voided: true })).toEqual({
      kind: 'VOID',
      payout: 20,
    });
  });
});
