import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

@Entity('wallets')
export class WalletRecord {
  @PrimaryColumn('varchar')
  userId!: string;

  @Column('numeric', { precision: 14, scale: 2, transformer: numericTransformer })
  balance!: number;
}
