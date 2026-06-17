import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { WalletCreditPort } from '../../../../shared-kernel/ports/WalletCreditPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { WalletRecord } from './WalletRecord';

export class TypeOrmWalletCreditAdapter implements WalletCreditPort {
  constructor(private readonly context: TransactionContext) {}

  async credit(userId: string, amount: number, opKey: string): Promise<void> {
    const manager = this.context.getManager();
    if (!manager) {
      throw new Error('wallet.credit doit être appelé dans une transaction (UnitOfWork)');
    }
    const inserted = await manager.query(
      'INSERT INTO wallet_operations ("opKey", "userId", "amount", "kind") VALUES ($1, $2, $3, $4) ON CONFLICT ("opKey") DO NOTHING RETURNING "opKey"',
      [opKey, userId, amount, 'CREDIT'],
    );
    if (inserted.length === 0) {
      return;
    }
    const result = await manager
      .createQueryBuilder()
      .update(WalletRecord)
      .set({ balance: () => 'balance + :amount' })
      .where('"userId" = :userId', { userId })
      .setParameter('amount', amount)
      .execute();
    if (!result.affected) {
      throw new DomainError('Wallet introuvable pour le crédit');
    }
  }
}
