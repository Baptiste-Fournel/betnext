import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bet_events')
export class BetEventRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  seq!: string;

  @Index()
  @Column('varchar')
  betId!: string;

  @Column('varchar')
  type!: string;

  @Column('int', { default: 1 })
  version!: number;

  @Column('text')
  payload!: string;

  @Column('timestamptz')
  occurredAt!: Date;
}
