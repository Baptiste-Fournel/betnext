import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/** Solde du wallet, propriété du contexte Wallet. */
@Entity('wallets')
export class WalletRecord {
  @PrimaryColumn('varchar')
  userId!: string;

  @Column('numeric', { precision: 14, scale: 2, transformer: numericTransformer })
  balance!: number;
}
