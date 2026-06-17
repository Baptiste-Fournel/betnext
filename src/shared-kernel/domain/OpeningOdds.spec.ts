import { openingOdds, OPENING_ODDS_VALUE } from './OpeningOdds';
import { Odds } from './Odds';

describe("OpeningOdds (ligne d'ouverture — source unique cote affichée + cote figée)", () => {
  it('shouldExposeAValidOpeningOdds_WhenMarketHasNoVolume', () => {
    // Act
    const odds = openingOdds();

    // Assert
    expect(odds).toBeInstanceOf(Odds);
    expect(odds.value).toBe(OPENING_ODDS_VALUE);
  });

  it('shouldKeepOpeningWithinAllowedRange_WhenComparedToOddsBounds', () => {
    // Assert — une ligne d'ouverture hors bornes casserait Odds.of() et donc le pari
    expect(OPENING_ODDS_VALUE).toBeGreaterThanOrEqual(Odds.MIN);
    expect(OPENING_ODDS_VALUE).toBeLessThanOrEqual(Odds.MAX);
  });
});
