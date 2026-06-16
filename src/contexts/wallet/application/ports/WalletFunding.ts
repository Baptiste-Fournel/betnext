/**
 * Port INTERNE au contexte Wallet (pas dans le Shared Kernel : non consommé par un autre contexte).
 * Ouvre/alimente un wallet avec un solde d'ouverture en écrivant, dans la MÊME transaction, le solde
 * ET l'entrée d'ouverture du ledger (`wallet_operations`, kind `OPENING`) → le ledger est complet dès
 * l'origine (BET-15), donc l'invariant Σ(mouvements) == solde tient dès le premier mouvement.
 */
export const WALLET_FUNDING = Symbol('WalletFunding');

export interface WalletFunding {
  /**
   * Ouvre un wallet avec `openingBalance`. IDEMPOTENT : ré-ouvrir un wallet existant est un no-op
   * (opKey `opening:<userId>`). Retourne true s'il a été ouvert, false s'il existait déjà.
   */
  open(userId: string, openingBalance: number): Promise<boolean>;
}
