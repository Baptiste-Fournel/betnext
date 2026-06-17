import { StakeGuardPort } from '../../../shared-kernel/ports/StakeGuardPort';
import { ComplianceStore } from './ports/ComplianceStore';
import { CompliancePolicyRegistry } from './CompliancePolicyRegistry';

export class ReserveStake implements StakeGuardPort {
  constructor(
    private readonly store: ComplianceStore,
    private readonly registry: CompliancePolicyRegistry,
  ) {}

  async reserve(userId: string, stake: number, at: Date): Promise<void> {
    const day = ReserveStake.dayKey(at);
    const { dayTotalStaked, dailyCap } = await this.store.loadForReserve(userId, day);
    this.registry.checkAll({ userId, stake, dayTotalStaked, dailyCap });
    await this.store.addStake(userId, day, stake);
  }

  private static dayKey(at: Date): string {
    return at.toISOString().slice(0, 10);
  }
}
