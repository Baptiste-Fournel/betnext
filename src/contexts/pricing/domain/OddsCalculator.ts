import { Odds } from '../../../shared-kernel/domain/Odds';

export type StakeByOutcome = ReadonlyMap<string, number>;

export class OddsCalculator {
  compute(stakes: StakeByOutcome): Map<string, Odds> {
    const totalEvent = [...stakes.values()].reduce((sum, s) => sum + s, 0);
    const result = new Map<string, Odds>();
    for (const [outcomeId, staked] of stakes) {
      const ratio = staked === 0 ? Infinity : totalEvent / staked;
      result.set(outcomeId, Odds.fromRatio(ratio));
    }
    return result;
  }
}
