import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { ComplianceStore } from './ports/ComplianceStore';

/** Le joueur définit/modifie son plafond quotidien (possédé par Responsible Gaming). */
export class SetDailyCap {
  constructor(private readonly store: ComplianceStore) {}

  async execute(userId: string, cap: number): Promise<void> {
    if (!(cap > 0)) {
      throw new DomainError('Daily cap must be strictly positive');
    }
    await this.store.setDailyCap(userId, cap);
  }
}
