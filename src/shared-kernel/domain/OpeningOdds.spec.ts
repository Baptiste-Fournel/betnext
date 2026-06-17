import { openingOdds, OPENING_ODDS_VALUE } from './OpeningOdds';
import { Odds } from './Odds';

describe('OpeningOdds (opening line — single source for displayed + locked odds)', () => {
  it('shouldExposeAValidOpeningOdds_WhenMarketHasNoVolume', () => {
    // Act
    const odds = openingOdds();

    // Assert
    expect(odds).toBeInstanceOf(Odds);
    expect(odds.value).toBe(OPENING_ODDS_VALUE);
  });

  it('shouldKeepOpeningWithinAllowedRange_WhenComparedToOddsBounds', () => {
    // Assert
    expect(OPENING_ODDS_VALUE).toBeGreaterThanOrEqual(Odds.MIN);
    expect(OPENING_ODDS_VALUE).toBeLessThanOrEqual(Odds.MAX);
  });
});
