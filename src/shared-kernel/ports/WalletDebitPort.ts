export const WALLET_DEBIT_PORT = Symbol('WalletDebitPort');

export interface WalletDebitPort {
  debit(userId: string, amount: number, idempotencyKey: string): Promise<void>;
}
