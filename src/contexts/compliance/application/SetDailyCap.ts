import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { ComplianceStore } from './ports/ComplianceStore';

export class SetDailyCap {
  constructor(private readonly store: ComplianceStore) {}

  async execute(userId: string, cap: number): Promise<void> {
    if (!(cap > 0)) {
      throw new DomainError('Daily cap must be strictly positive');
    }
    await this.store.setDailyCap(userId, cap);
  }
}
