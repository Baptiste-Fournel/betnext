/** Port wallet. La clé d'idempotence garantit un seul débit par tentative (ADR-008). */
export interface WalletPort {
  debit(userId: string, amount: number, idempotencyKey: string): Promise<void>;
}
