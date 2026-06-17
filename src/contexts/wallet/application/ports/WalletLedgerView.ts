export const WALLET_LEDGER_VIEW = Symbol('WalletLedgerView');

export interface WalletLedgerRow {
  userId: string;
  balance: number;
  ledgerSum: number;
}

export interface WalletLedgerView {
  loadLedgerVsBalance(): Promise<WalletLedgerRow[]>;
}
