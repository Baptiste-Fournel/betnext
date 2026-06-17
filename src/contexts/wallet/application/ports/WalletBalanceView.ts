export const WALLET_BALANCE_VIEW = Symbol('WalletBalanceView');

export interface WalletBalanceView {
  balanceOf(userId: string): Promise<number | null>;
}
