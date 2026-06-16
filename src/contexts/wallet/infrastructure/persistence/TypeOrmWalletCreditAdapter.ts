import { WalletCreditPort } from '../../../../shared-kernel/ports/WalletCreditPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';

/**
 * Crédit wallet EXACTEMENT-UNE-FOIS sur Postgres. Dans la transaction ambiante : INSERT du `opKey`
 * (`ON CONFLICT DO NOTHING`) → si déjà présent, no-op (rejeu/retry sans double-crédit) ; sinon
 * UPDATE `balance += montant`. Atomique avec le règlement du pari (même transaction). Refuse
 * l'auto-commit (doit tourner dans une UnitOfWork) → jamais de crédit hors règlement atomique.
 */
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
      return; // déjà appliqué → no-op (exactement-une-fois)
    }
    await manager.query('UPDATE wallets SET balance = balance + $1 WHERE "userId" = $2', [
      amount,
      userId,
    ]);
  }
}
