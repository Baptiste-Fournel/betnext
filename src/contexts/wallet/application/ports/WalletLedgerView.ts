/**
 * Port INTERNE au contexte Wallet : vue de réconciliation (lecture seule). Pour CHAQUE wallet, expose
 * son solde stocké et la somme de ses mouvements (ledger autoritaire). La réconciliation (BET-15)
 * compare les deux. L'implémentation Postgres lit les deux dans UN SEUL instantané cohérent (une seule
 * requête) → pas de lecture « déchirée » entre le solde et la somme du ledger.
 */
export const WALLET_LEDGER_VIEW = Symbol('WalletLedgerView');

export interface WalletLedgerRow {
  userId: string;
  /** Solde stocké (`wallets.balance`). */
  balance: number;
  /** Σ des mouvements signés (`wallet_operations.amount`), entrée d'ouverture incluse. */
  ledgerSum: number;
}

export interface WalletLedgerView {
  loadLedgerVsBalance(): Promise<WalletLedgerRow[]>;
}
