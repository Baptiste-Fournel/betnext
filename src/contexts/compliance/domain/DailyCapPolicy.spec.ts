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

  it('aucun plafond → autorisé', () => {
    expect(() => policy.check(snap(50, 0, null))).not.toThrow();
  });
  it('sous le plafond → autorisé', () => {
    expect(() => policy.check(snap(30, 60, 100))).not.toThrow();
  });
  it('pile au plafond → autorisé (limite incluse)', () => {
    expect(() => policy.check(snap(40, 60, 100))).not.toThrow();
  });
  it('dépasse le plafond → DailyCapExceededError', () => {
    expect(() => policy.check(snap(50, 60, 100))).toThrow(DailyCapExceededError);
  });
});
