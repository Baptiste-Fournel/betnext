export const WALLET_FUNDING = Symbol('WalletFunding');

export interface WalletFunding {
  open(userId: string, openingBalance: number): Promise<boolean>;
}
