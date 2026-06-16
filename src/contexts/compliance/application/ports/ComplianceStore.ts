export const COMPLIANCE_STORE = Symbol('ComplianceStore');

export interface DailyReservation {
  dayTotalStaked: number;
  dailyCap: number | null;
}

/**
 * Port de persistance du contexte Responsible Gaming (il POSSÈDE ces données). `loadForReserve`
 * VERROUILLE la ligne du jour (atomicité/anti-course) et renvoie total + plafond ; à appeler dans
 * la transaction ambiante de pose. `addStake` enregistre la mise réservée (total BRUT du jour).
 */
export interface ComplianceStore {
  loadForReserve(userId: string, day: string): Promise<DailyReservation>;
  addStake(userId: string, day: string, stake: number): Promise<void>;
  setDailyCap(userId: string, cap: number): Promise<void>;
}
