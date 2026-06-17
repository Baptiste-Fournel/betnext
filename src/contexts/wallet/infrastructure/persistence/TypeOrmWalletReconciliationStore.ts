import { DataSource } from 'typeorm';
import { WalletLedgerView, WalletLedgerRow } from '../../application/ports/WalletLedgerView';

interface RawRow {
  userId: string;
  balance: string;
  ledgerSum: string;
}

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
