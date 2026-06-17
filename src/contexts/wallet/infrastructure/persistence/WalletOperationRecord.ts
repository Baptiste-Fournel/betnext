import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

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
