import { CompliancePolicy, ComplianceSnapshot } from '../domain/CompliancePolicy';

/** Jeton d'injection de la LISTE des règles actives (composée dans le module — point d'extension). */
export const COMPLIANCE_POLICIES = Symbol('CompliancePolicies');

/**
 * Registre des règles de jeu responsable (ADR-010). Les règles sont INJECTÉES (pas codées en dur) :
 * ajouter une règle = un nouveau fichier de policy + 1 entrée dans la liste `COMPLIANCE_POLICIES` du
 * module — ce registre ET `ReserveStake` restent INCHANGÉS (Open/Closed). `checkAll` les applique toutes.
 */
export class CompliancePolicyRegistry {
  constructor(private readonly policies: CompliancePolicy[]) {}

  checkAll(snapshot: ComplianceSnapshot): void {
    for (const policy of this.policies) {
      policy.check(snapshot);
    }
  }

  keys(): string[] {
    return this.policies.map((policy) => policy.key);
  }
}
