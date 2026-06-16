import { DataSource } from 'typeorm';
import { WalletLedgerView, WalletLedgerRow } from '../../application/ports/WalletLedgerView';

interface RawRow {
  userId: string;
  balance: string; // numeric → string par le driver pg
  ledgerSum: string;
}

/**
 * Vue de réconciliation sur Postgres (lecture seule). UNE SEULE requête joint chaque wallet à la
 * somme de ses mouvements → instantané COHÉRENT (cohérence au niveau instruction en READ COMMITTED) :
 * solde et somme du ledger sont lus au même instant, donc jamais « déchirés » par un règlement qui
 * commiterait entre deux lectures.
 *
 * `FULL OUTER JOIN` (et non LEFT JOIN depuis `wallets`) : on contrôle **les deux** côtés —
 *  - un wallet sans mouvement (ledger vide → somme 0) ;
 *  - et surtout une ligne de ledger **ORPHELINE** (un `userId` présent dans `wallet_operations` mais
 *    absent de `wallets`) : `balance` COALESCE à 0 → écart rapporté. Sans cela, une somme de ledger
 *    sans solde correspondant échapperait totalement à la réconciliation (faux négatif).
 *
 * Lecture pure : aucune écriture → job rejouable (idempotent).
 */
export class TypeOrmWalletReconciliationStore implements WalletLedgerView {
  constructor(private readonly dataSource: DataSource) {}

  async loadLedgerVsBalance(): Promise<WalletLedgerRow[]> {
    const rows: RawRow[] = await this.dataSource.query(
      `SELECT COALESCE(w."userId", l."userId") AS "userId",
              COALESCE(w."balance", 0) AS "balance",
              COALESCE(l."s", 0) AS "ledgerSum"
         FROM wallets w
         FULL OUTER JOIN (
           SELECT "userId", SUM("amount") AS "s"
             FROM wallet_operations
            GROUP BY "userId"
         ) l ON l."userId" = w."userId"`,
    );
    return rows.map((r) => ({
      userId: r.userId,
      balance: Number(r.balance),
      ledgerSum: Number(r.ledgerSum),
    }));
  }
}
