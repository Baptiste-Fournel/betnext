import { ReserveStake } from './ReserveStake';
import { CompliancePolicyRegistry } from './CompliancePolicyRegistry';
import { DailyCapPolicy } from '../domain/DailyCapPolicy';
import { ComplianceStore, DailyReservation } from './ports/ComplianceStore';
import { DailyCapExceededError } from '../domain/DailyCapExceededError';

/** Double inline (la couche application ne dépend pas d'un adapter d'infrastructure — frontière). */
class FakeStore implements ComplianceStore {
  private readonly caps = new Map<string, number>();
  private readonly stakes = new Map<string, number>();
  constructor(cap?: number) {
    if (cap !== undefined) this.caps.set('u1', cap);
  }
  async loadForReserve(userId: string, day: string): Promise<DailyReservation> {
    return {
      dayTotalStaked: this.stakes.get(`${userId}:${day}`) ?? 0,
      dailyCap: this.caps.has(userId) ? (this.caps.get(userId) as number) : null,
    };
  }
  async addStake(userId: string, day: string, stake: number): Promise<void> {
    const key = `${userId}:${day}`;
    this.stakes.set(key, (this.stakes.get(key) ?? 0) + stake);
  }
  async setDailyCap(userId: string, cap: number): Promise<void> {
    this.caps.set(userId, cap);
  }
  staked(userId: string, day: string): number {
    return this.stakes.get(`${userId}:${day}`) ?? 0;
  }
}

describe('ReserveStake (vérif plafond via la couture Policy, dans la tx de pose)', () => {
  const at = new Date('2026-06-16T10:00:00Z');

  it('sous le plafond → réserve et accumule la mise du jour', async () => {
    const store = new FakeStore(100);
    const reserve = new ReserveStake(store, new CompliancePolicyRegistry([new DailyCapPolicy()]));
    await reserve.reserve('u1', 40, at);
    await reserve.reserve('u1', 30, at);
    expect(store.staked('u1', '2026-06-16')).toBe(70);
  });

  it('dépassement → refus (DailyCapExceededError) et mise NON réservée', async () => {
    const store = new FakeStore(100);
    const reserve = new ReserveStake(store, new CompliancePolicyRegistry([new DailyCapPolicy()]));
    await reserve.reserve('u1', 80, at);
    await expect(reserve.reserve('u1', 30, at)).rejects.toBeInstanceOf(DailyCapExceededError);
    expect(store.staked('u1', '2026-06-16')).toBe(80); // la mise refusée n'est pas comptée
  });

  it('aucun plafond défini → illimité', async () => {
    const store = new FakeStore();
    const reserve = new ReserveStake(store, new CompliancePolicyRegistry([new DailyCapPolicy()]));
    await reserve.reserve('u1', 9999, at);
    expect(store.staked('u1', '2026-06-16')).toBe(9999);
  });
});
