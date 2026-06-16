import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/**
 * Journal des crédits/remboursements. `opKey` en CLÉ PRIMAIRE = garde-fou EXACTEMENT-UNE-FOIS :
 * un 2e crédit avec la même clé viole la PK → aucun double-crédit. Sert aussi de piste d'audit.
 */
@Entity('wallet_operations')
export class WalletOperationRecord {
  @PrimaryColumn('varchar')
  opKey!: string;

  @Column('varchar')
  userId!: string;

  @Column('numeric', { precision: 14, scale: 2, transformer: numericTransformer })
  amount!: number;

  @Column('varchar')
  kind!: string;

  @Column('timestamptz', { default: () => 'now()' })
  createdAt!: Date;
}
