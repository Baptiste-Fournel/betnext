/**
 * Contrat PARTAGÉ (Shared Kernel) pour CRÉDITER le wallet (paiement de gain, remboursement) depuis
 * Betting, sans accès direct aux tables. EXACTEMENT-UNE-FOIS : `opKey` rend le crédit idempotent —
 * rejouer la même opération (retry / re-livraison at-least-once) ne déplace jamais le solde deux
 * fois (ADR-004 : la compensation/paiement ne doit pas double-créditer).
 */
export const WALLET_CREDIT_PORT = Symbol('WalletCreditPort');

export interface WalletCreditPort {
  credit(userId: string, amount: number, opKey: string): Promise<void>;
}
