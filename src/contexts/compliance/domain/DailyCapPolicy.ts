import { CompliancePolicy, ComplianceSnapshot } from './CompliancePolicy';
import { DailyCapExceededError } from './DailyCapExceededError';

export const DAILY_CAP_POLICY = 'DAILY_CAP';

export class DailyCapPolicy implements CompliancePolicy {
  readonly key = DAILY_CAP_POLICY;

  check(snapshot: ComplianceSnapshot): void {
    if (snapshot.dailyCap === null) {
      return;
    }
    if (snapshot.dayTotalStaked + snapshot.stake > snapshot.dailyCap) {
      throw new DailyCapExceededError(
        snapshot.userId,
        snapshot.dailyCap,
        snapshot.dayTotalStaked,
        snapshot.stake,
      );
    }
  }
}
