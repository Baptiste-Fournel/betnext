import { DomainError } from '../../../../shared-kernel/domain/DomainError';
import { WalletDebitPort } from '../../../../shared-kernel/ports/WalletDebitPort';
import { TransactionContext } from '../../../../persistence/TransactionContext';
import { WalletRecord } from './WalletRecord';

/**
 * Adapter Postgres du débit wallet. Deux garde-fous, dans la transaction ambiante (TransactionContext) :
 *  1. JOURNALISE le mouvement dans `wallet_operations` (montant SIGNÉ négatif, kind `DEBIT`, opKey
 *     `stake:<ref>`) AVANT de toucher le solde → le ledger est COMPLET (BET-15) : Σ(mouvements) reste
 *     égal au solde, donc la réconciliation peut détecter toute dérive. `ON CONFLICT DO NOTHING` rend
 *     le débit EXACTEMENT-UNE-FOIS (rejeu / retry avec la même réf → no-op, jamais de double-débit) —
 *     symétrique du crédit (BET-12).
 *  2. DÉBITE `wallets` via un UPDATE conditionnel ATOMIQUE (`balance >= montant`) → pas de
 *     read-modify-write, donc pas de lost update sous concurrence (BET-5). 0 ligne affectée → solde
 *     insuffisant → on LÈVE, ce qui roule en arrière l'écriture du ledger (même tx) : jamais de
 *     mouvement orphelin.
 *
 * S'exécute DANS la transaction du pari (BET-5) et REFUSE l'auto-commit (sinon fenêtre d'état partiel :
 * débit/ledger sans pari).
 */
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
      return; // déjà appliqué → no-op (exactement-une-fois)
    }
    // UPDATE conditionnel atomique (affected fiable via queryBuilder, vs tuple renvoyé par query brut).
    const result = await manager
      .createQueryBuilder()
      .update(WalletRecord)
      .set({ balance: () => 'balance - :amount' })
      .where('"userId" = :userId', { userId })
      .andWhere('balance >= :amount', { amount })
      .execute();
    if (!result.affected) {
      // 0 ligne affectée → solde insuffisant (ou wallet absent) → rollback du ledger (même tx).
      throw new DomainError('Insufficient balance');
    }
  }
}
