import { ComplianceStore, DailyReservation } from '../application/ports/ComplianceStore';

/** Adapter en mémoire (mode sans DATABASE_URL / tests). La course réelle est prouvée sur Postgres. */
export class InMemoryComplianceStore implements ComplianceStore {
  private readonly caps = new Map<string, number>();
  private readonly stakes = new Map<string, number>();

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

  async currentCap(userId: string): Promise<number | null> {
    return this.caps.has(userId) ? (this.caps.get(userId) as number) : null;
  }
}
