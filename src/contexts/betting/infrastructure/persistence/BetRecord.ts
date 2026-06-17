import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

@Entity('bets')
export class BetRecord {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar')
  userId!: string;

  @Column('varchar')
  outcomeId!: string;

  @Column('numeric', { precision: 14, scale: 2, transformer: numericTransformer })
  stake!: number;

  @Column('numeric', { precision: 6, scale: 2, transformer: numericTransformer })
  lockedOdds!: number;

  @Column('numeric', { precision: 14, scale: 2, transformer: numericTransformer })
  potentialGain!: number;

  @Column('varchar')
  status!: string;

  @Column('timestamptz')
  createdAt!: Date;
}
