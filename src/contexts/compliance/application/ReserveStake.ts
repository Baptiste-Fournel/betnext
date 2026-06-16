import { StakeGuardPort } from '../../../shared-kernel/ports/StakeGuardPort';
import { ComplianceStore } from './ports/ComplianceStore';
import { CompliancePolicyRegistry } from './CompliancePolicyRegistry';

/**
 * Implémente le port partagé StakeGuardPort. Dans la transaction de pose : VERROUILLE la ligne du
 * jour (loadForReserve → FOR UPDATE), applique les RÈGLES enfichables (registre), puis enregistre la
 * mise. Le verrou sérialise les paris concurrents du même joueur/jour → pas de course où deux paris
 * passent le contrôle puis dépassent ensemble le plafond.
 *
 * PÉRIMÈTRE (assumé, signalé) : le total est BRUT (somme des mises posées du jour), PAS net des
 * annulations/remboursements — un pari VOID ne libère pas (encore) le plafond. Le « net » exigerait
 * que le règlement (SettleMarket, VOID) appelle un release sur ce contexte ; suivi séparé.
 */
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

  /** HYPOTHÈSE NON VALIDÉE (signalée) : « jour » = date UTC (reset minuit UTC). Fuseau/reset à trancher. */
  private static dayKey(at: Date): string {
    return at.toISOString().slice(0, 10);
  }
}
