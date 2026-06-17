export const COMPLIANCE_STORE = Symbol('ComplianceStore');

export interface DailyReservation {
  dayTotalStaked: number;
  dailyCap: number | null;
}

export interface ComplianceStore {
  loadForReserve(userId: string, day: string): Promise<DailyReservation>;
  addStake(userId: string, day: string, stake: number): Promise<void>;
  setDailyCap(userId: string, cap: number): Promise<void>;
  currentCap(userId: string): Promise<number | null>;
}
