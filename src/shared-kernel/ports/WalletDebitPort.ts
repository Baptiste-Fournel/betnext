/**
 * Contrat PARTAGÉ (Shared Kernel) pour débiter le wallet depuis un autre contexte, SANS accès
 * direct à ses tables. Le contexte Wallet fournit l'implémentation ; Betting le consomme via ce
 * port (aucun import croisé betting↔wallet). « Ready-to-split » : quand Wallet sera extrait, le
 * contrat reste, l'impl devient un adapter distant + Saga/compensation (défi 3).
 */
export const WALLET_DEBIT_PORT = Symbol('WalletDebitPort');

export interface WalletDebitPort {
  /** Débite le solde de l'utilisateur. Lève une DomainError si solde insuffisant. */
  debit(userId: string, amount: number, idempotencyKey: string): Promise<void>;
}
