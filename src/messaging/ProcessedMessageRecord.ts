import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Dé-doublonnage du consommateur (ADR-008) : un id de message traité = une ligne. PK = garde-fou. */
@Entity('processed_messages')
export class ProcessedMessageRecord {
  @PrimaryColumn('uuid')
  messageId!: string;

  @Column('timestamptz', { default: () => 'now()' })
  processedAt!: Date;
}
