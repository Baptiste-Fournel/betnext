export const WALLET_CREDIT_PORT = Symbol('WalletCreditPort');

export interface WalletCreditPort {
  credit(userId: string, amount: number, opKey: string): Promise<void>;
}
