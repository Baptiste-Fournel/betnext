import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { WalletRefundPort } from '../../application/ports/WalletRefundPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { WalletRecord } from './WalletRecord';

// Reverse de crédit (compensation) : ligne ledger signée NÉGATIVE (kind `REFUND`) + décrément du
// solde, dans la MÊME transaction (UnitOfWork). Idempotent par `opKey` (ON CONFLICT DO NOTHING) →
// un rejeu de compensation ne re-débite jamais. Σ(ledger) == solde reste vrai à chaque commit.
export class TypeOrmWalletRefundAdapter implements WalletRefundPort {
  constructor(private readonly context: TransactionContext) {}

  async refund(userId: string, amount: number, opKey: string): Promise<void> {
    const manager = this.context.getManager();
    if (!manager) {
      throw new Error('wallet.refund doit être appelé dans une transaction (UnitOfWork)');
    }
    const inserted = await manager.query(
      'INSERT INTO wallet_operations ("opKey", "userId", "amount", "kind") VALUES ($1, $2, $3, $4) ON CONFLICT ("opKey") DO NOTHING RETURNING "opKey"',
      [opKey, userId, -amount, 'REFUND'],
    );
    if (inserted.length === 0) {
      return;
    }
    const result = await manager
      .createQueryBuilder()
      .update(WalletRecord)
      .set({ balance: () => 'balance - :amount' })
      .where('"userId" = :userId', { userId })
      .setParameter('amount', amount)
      .execute();
    if (!result.affected) {
      throw new DomainError('Wallet introuvable pour le remboursement');
    }
  }
}
