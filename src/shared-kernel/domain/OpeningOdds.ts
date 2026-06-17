import { Odds } from './Odds';

export const OPENING_ODDS_VALUE = 2;

export function openingOdds(): Odds {
  return Odds.of(OPENING_ODDS_VALUE);
}
