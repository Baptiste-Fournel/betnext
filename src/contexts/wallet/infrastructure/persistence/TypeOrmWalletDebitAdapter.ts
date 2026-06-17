import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { WalletDebitPort } from '../../../../shared-kernel/ports/WalletDebitPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { WalletRecord } from './WalletRecord';

export class TypeOrmWalletDebitAdapter implements WalletDebitPort {
  constructor(private readonly context: TransactionContext) {}

  async debit(userId: string, amount: number, operationRef: string): Promise<void> {
    const manager = this.context.getManager();
    if (!manager) {
      throw new Error('wallet.debit doit être appelé dans une transaction (UnitOfWork)');
    }
    const inserted = await manager.query(
      'INSERT INTO wallet_operations ("opKey", "userId", "amount", "kind") VALUES ($1, $2, $3, $4) ON CONFLICT ("opKey") DO NOTHING RETURNING "opKey"',
      [`stake:${operationRef}`, userId, -amount, 'DEBIT'],
    );
    if (inserted.length === 0) {
      return;
    }
    const result = await manager
      .createQueryBuilder()
      .update(WalletRecord)
      .set({ balance: () => 'balance - :amount' })
      .where('"userId" = :userId', { userId })
      .andWhere('balance >= :amount', { amount })
      .execute();
    if (!result.affected) {
      throw new DomainError('Insufficient balance');
    }
  }
}
