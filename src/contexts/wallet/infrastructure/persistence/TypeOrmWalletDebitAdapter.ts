import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { WalletDebitPort } from '../../../../shared-kernel/ports/WalletDebitPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { WalletRecord } from './WalletRecord';

/**
 * Adapter Postgres du débit wallet. Débite `wallets` (propriété du contexte Wallet) via un UPDATE
 * conditionnel ATOMIQUE (`balance >= montant`) → pas de read-modify-write, donc pas de lost update
 * sous concurrence. S'exécute DANS la transaction ambiante (TransactionContext) pour être atomique
 * avec le pari (BET-5), et REFUSE l'auto-commit (sinon fenêtre d'état partiel : débit sans pari).
 * Idempotence : clé fournie par le CLIENT = BET-8.
 */
export class TypeOrmWalletDebitAdapter implements WalletDebitPort {
  constructor(private readonly context: TransactionContext) {}

  async debit(userId: string, amount: number, _idempotencyKey: string): Promise<void> {
    const manager = this.context.getManager();
    if (!manager) {
      throw new Error('wallet.debit doit être appelé dans une transaction (UnitOfWork)');
    }
    const result = await manager
      .createQueryBuilder()
      .update(WalletRecord)
      .set({ balance: () => 'balance - :amount' })
      .where('"userId" = :userId', { userId })
      .andWhere('balance >= :amount', { amount })
      .execute();
    if (!result.affected) {
      // 0 ligne affectée → solde insuffisant (ou wallet absent).
      throw new DomainError('Insufficient balance');
    }
  }
}
