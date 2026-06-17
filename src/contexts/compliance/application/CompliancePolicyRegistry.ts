import { CompliancePolicy, ComplianceSnapshot } from '../domain/CompliancePolicy';

export const COMPLIANCE_POLICIES = Symbol('CompliancePolicies');

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
