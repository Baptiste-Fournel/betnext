import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numericTransformer } from './numeric.transformer';

/** Clé d'idempotence HTTP + hash du corps + résultat figé (betId/cote/gain). PK = garde-fou concurrent. */
@Entity('idempotency_keys')
export class IdempotencyKeyRecord {
  @PrimaryColumn('varchar')
  key!: string;

  @Column('varchar')
  requestHash!: string;

  @Column('varchar', { nullable: true })
  betId!: string | null;

  @Column('numeric', { precision: 6, scale: 2, nullable: true, transformer: numericTransformer })
  lockedOdds!: number | null;

  @Column('numeric', { precision: 14, scale: 2, nullable: true, transformer: numericTransformer })
  potentialGain!: number | null;

  @Column('timestamptz', { default: () => 'now()' })
  createdAt!: Date;
}
