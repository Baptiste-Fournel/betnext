export interface ComplianceSnapshot {
  userId: string;
  stake: number;
  dayTotalStaked: number;
  dailyCap: number | null;
}

export interface CompliancePolicy {
  readonly key: string;
  check(snapshot: ComplianceSnapshot): void;
}
