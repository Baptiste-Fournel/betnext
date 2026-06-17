import { ComplianceStore } from './ports/ComplianceStore';

export class GetDailyCap {
  constructor(private readonly store: ComplianceStore) {}

  execute(userId: string): Promise<number | null> {
    return this.store.currentCap(userId);
  }
}
