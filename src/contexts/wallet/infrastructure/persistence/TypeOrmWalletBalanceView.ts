import { DataSource } from 'typeorm';
import { WalletBalanceView } from '../../application/ports/WalletBalanceView';
import { WalletRecord } from './WalletRecord';

// Lecture seule du solde (read-side). Hors transaction d'écriture : simple SELECT.
export class TypeOrmWalletBalanceView implements WalletBalanceView {
  constructor(private readonly dataSource: DataSource) {}

  async balanceOf(userId: string): Promise<number | null> {
    const row = await this.dataSource.getRepository(WalletRecord).findOne({ where: { userId } });
    return row ? Number(row.balance) : null;
  }
}
