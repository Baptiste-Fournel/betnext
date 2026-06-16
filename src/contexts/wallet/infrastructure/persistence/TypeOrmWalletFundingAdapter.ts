import { DataSource } from 'typeorm';
import { WalletFunding } from '../../application/ports/WalletFunding';

/**
 * Ouverture/alimentation d'un wallet sur Postgres. Opération AUTONOME (hors transaction de pari) :
 * ouvre sa PROPRE transaction et y écrit ATOMIQUEMENT (1) la ligne `wallets` et (2) l'entrée
 * d'ouverture du ledger (`OPENING`, montant positif). `ON CONFLICT DO NOTHING` sur `wallets` rend
 * l'ouverture idempotente : un wallet déjà ouvert → no-op, et on ne touche jamais au ledger.
 */
export class TypeOrmWalletFundingAdapter implements WalletFunding {
  constructor(private readonly dataSource: DataSource) {}

  async open(userId: string, openingBalance: number): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager.query(
        'INSERT INTO wallets ("userId", "balance") VALUES ($1, $2) ON CONFLICT ("userId") DO NOTHING RETURNING "userId"',
        [userId, openingBalance],
      );
      if (inserted.length === 0) {
        return false; // wallet déjà ouvert → no-op (idempotent)
      }
      await manager.query(
        'INSERT INTO wallet_operations ("opKey", "userId", "amount", "kind") VALUES ($1, $2, $3, $4) ON CONFLICT ("opKey") DO NOTHING',
        [`opening:${userId}`, userId, openingBalance, 'OPENING'],
      );
      return true;
    });
  }
}
