import { Column, Entity, PrimaryColumn } from 'typeorm';

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
