import { ComplianceStore } from './ports/ComplianceStore';

/** Le joueur consulte son plafond quotidien (null si non défini). Lecture pure (pas de règle métier). */
export class GetDailyCap {
  constructor(private readonly store: ComplianceStore) {}

  execute(userId: string): Promise<number | null> {
    return this.store.currentCap(userId);
  }
}
