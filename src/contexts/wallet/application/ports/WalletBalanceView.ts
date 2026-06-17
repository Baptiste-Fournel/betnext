export const WALLET_BALANCE_VIEW = Symbol('WalletBalanceView');

// Lecture seule du solde courant d'un wallet (CQRS read-side). `null` si le wallet n'existe pas.
export interface WalletBalanceView {
  balanceOf(userId: string): Promise<number | null>;
}
