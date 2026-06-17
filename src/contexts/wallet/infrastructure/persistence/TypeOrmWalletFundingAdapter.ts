import { DataSource } from 'typeorm';
import { WalletFunding } from '../../application/ports/WalletFunding';

export class TypeOrmWalletFundingAdapter implements WalletFunding {
  constructor(private readonly dataSource: DataSource) {}

  async open(userId: string, openingBalance: number): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager.query(
        'INSERT INTO wallets ("userId", "balance") VALUES ($1, $2) ON CONFLICT ("userId") DO NOTHING RETURNING "userId"',
        [userId, openingBalance],
      );
      if (inserted.length === 0) {
        return false;
      }
      await manager.query(
        'INSERT INTO wallet_operations ("opKey", "userId", "amount", "kind") VALUES ($1, $2, $3, $4) ON CONFLICT ("opKey") DO NOTHING',
        [`opening:${userId}`, userId, openingBalance, 'OPENING'],
      );
      return true;
    });
  }
}
