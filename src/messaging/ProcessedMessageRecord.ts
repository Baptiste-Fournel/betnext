import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_messages')
export class ProcessedMessageRecord {
  @PrimaryColumn('uuid')
  messageId!: string;

  @Column('timestamptz', { default: () => 'now()' })
  processedAt!: Date;
}
