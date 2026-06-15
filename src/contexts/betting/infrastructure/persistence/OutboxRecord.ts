import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Transactional Outbox (ADR-008). Écrite dans la MÊME transaction que le pari + ses événements :
 * si la transaction rollback, rien n'atterrit ici (pas de réouverture de la fenêtre de perte de BET-5).
 * Un relais polling publie les lignes `publishedAt IS NULL` vers la file, puis les marque publiées.
 */
@Entity('outbox')
export class OutboxRecord {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar')
  type!: string;

  @Column('text')
  payload!: string;

  @Column('timestamptz', { default: () => 'now()' })
  createdAt!: Date;

  @Column('timestamptz', { nullable: true })
  publishedAt!: Date | null;
}
