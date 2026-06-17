export const WALLET_REFUND_PORT = Symbol('WalletRefundPort');

export interface WalletRefundPort {
  refund(userId: string, amount: number, opKey: string): Promise<void>;
}
