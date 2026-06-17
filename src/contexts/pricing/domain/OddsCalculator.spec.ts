import { OddsCalculator } from './OddsCalculator';
import { Odds } from '../../../shared-kernel/domain/Odds';

describe('OddsCalculator (pari-mutuel, N-issues)', () => {
  const calc = new OddsCalculator();

  it('shouldProduceBalancedOdds_WhenStakesAreEqual', () => {
    // Arrange / Act
    const odds = calc.compute(
      new Map([
        ['A', 100],
        ['B', 100],
      ]),
    );

    // Assert
    expect(odds.get('A')!.value).toBe(2);
    expect(odds.get('B')!.value).toBe(2);
  });

  it('shouldClampFavoriteToMinAndOutsiderToMax_WhenStakesAreLopsided', () => {
    // Arrange / Act
    const odds = calc.compute(
      new Map([
        ['fav', 1000],
        ['outsider', 10],
      ]),
    );

    // Assert
    expect(odds.get('fav')!.value).toBe(Odds.MIN);
    expect(odds.get('outsider')!.value).toBe(Odds.MAX);
  });

  it('shouldGiveMaxOdds_WhenOutcomeHasNoStake', () => {
    // Arrange / Act
    const odds = calc.compute(
      new Map([
        ['A', 100],
        ['draw', 0],
      ]),
    );

    // Assert
    expect(odds.get('draw')!.value).toBe(Odds.MAX);
  });

  it('shouldSupportThreeOutcomeMarket_WhenWinAWinBDrawProvided', () => {
    // Arrange / Act
    const odds = calc.compute(
      new Map([
        ['A', 100],
        ['B', 100],
        ['draw', 100],
      ]),
    );

    // Assert
    expect(odds.size).toBe(3);
    expect(odds.get('A')!.value).toBe(3);
  });
});
