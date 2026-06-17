export const WALLET_REFUND_PORT = Symbol('WalletRefundPort');

// Reverse d'un crédit (compensation de saga) : écrit une ligne ledger signée NÉGATIVE (kind
// `REFUND`) ET décrémente le solde, dans la MÊME transaction, de façon IDEMPOTENTE (par `opKey`).
// Un rejeu de compensation ne re-débite jamais deux fois. Σ(ledger) reste == solde.
export interface WalletRefundPort {
  refund(userId: string, amount: number, opKey: string): Promise<void>;
}
