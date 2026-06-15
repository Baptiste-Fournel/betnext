export const PRICING_STORE = Symbol('PricingStore');

/**
 * État du service Pricing, derrière un PORT (hexagonal). Permet le SCALE-OUT : l'adapter Redis
 * (état PARTAGÉ entre répliques + survit au redémarrage) rend la cote pari-mutuel correcte même à
 * N workers ; l'adapter en mémoire sert le POC mono-process / les tests. `markProcessed` assure
 * l'IDEMPOTENCE du consommateur (livraison at-least-once → effet appliqué une seule fois).
 */
export interface PricingStore {
  /** true si ce message n'avait jamais été traité (sinon → re-livraison, à ignorer). */
  markProcessed(messageId: string): Promise<boolean>;
  add(outcomeId: string, stake: number): Promise<void>;
  totals(): Promise<ReadonlyMap<string, number>>;
}
