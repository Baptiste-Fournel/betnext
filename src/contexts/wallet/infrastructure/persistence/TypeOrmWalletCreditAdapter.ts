import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { WalletCreditPort } from '../../../../shared-kernel/ports/WalletCreditPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { WalletRecord } from './WalletRecord';

/**
 * Crédit wallet EXACTEMENT-UNE-FOIS sur Postgres. Dans la transaction ambiante : INSERT du `opKey`
 * (`ON CONFLICT DO NOTHING`) → si déjà présent, no-op (rejeu/retry sans double-crédit) ; sinon
 * `UPDATE balance += montant`. Atomique avec le règlement du pari (même transaction). Refuse
 * l'auto-commit (doit tourner dans une UnitOfWork) → jamais de crédit hors règlement atomique.
 *
 * SYMÉTRIE avec le débit (BET-15) : si l'UPDATE n'affecte **aucune** ligne (wallet introuvable), on
 * LÈVE → rollback de la ligne ledger (même tx). Sans ce garde, un crédit vers un wallet inexistant
 * écrirait une ligne `CREDIT` ORPHELINE sans bouger de solde → argent perdu en silence ET invariant
 * Σ(ledger)==solde violé à l'écriture. Le compteur `affected` est lu via queryBuilder (fiable), car
 * `manager.query('UPDATE … RETURNING')` renvoie un tuple `[rows, affected]`, pas un tableau de lignes.
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
    const result = await manager
      .createQueryBuilder()
      .update(WalletRecord)
      .set({ balance: () => 'balance + :amount' })
      .where('"userId" = :userId', { userId })
      .setParameter('amount', amount)
      .execute();
    if (!result.affected) {
      // 0 ligne → wallet introuvable → rollback de la ligne ledger (même tx) : jamais d'orpheline.
      throw new DomainError('Wallet introuvable pour le crédit');
    }
  }
}
