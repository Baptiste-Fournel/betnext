import { DailyCapPolicy } from './DailyCapPolicy';
import { DailyCapExceededError } from './DailyCapExceededError';

describe('DailyCapPolicy (1re règle de jeu responsable)', () => {
  const policy = new DailyCapPolicy();
  const snap = (stake: number, dayTotalStaked: number, dailyCap: number | null) => ({
    userId: 'u1',
    stake,
    dayTotalStaked,
    dailyCap,
  });

  it('shouldBeAllowed_WhenNoCapDefined', () => {
    // Act / Assert
    expect(() => policy.check(snap(50, 0, null))).not.toThrow();
  });

  it('shouldBeAllowed_WhenStakeUnderCap', () => {
    // Act / Assert
    expect(() => policy.check(snap(30, 60, 100))).not.toThrow();
  });

  it('shouldBeAllowed_WhenStakeExactlyAtCap', () => {
    // Act / Assert
    expect(() => policy.check(snap(40, 60, 100))).not.toThrow();
  });

  it('shouldThrowDailyCapExceeded_WhenStakeOverCap', () => {
    // Act / Assert
    expect(() => policy.check(snap(50, 60, 100))).toThrow(DailyCapExceededError);
  });
});
