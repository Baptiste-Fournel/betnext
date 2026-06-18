import { Column, Entity, PrimaryColumn } from 'typeorm';
import { MatchOutcomeSide } from '../../domain/MatchReport';

@Entity('match_links')
export class MatchLinkRecord {
  @PrimaryColumn('varchar')
  matchId!: string;

  @Column('varchar', { nullable: true })
  marketId!: string | null;

  @Column('jsonb', { default: () => "'[]'" })
  outcomes!: string[];

  @Column('jsonb', { default: () => "'{}'" })
  mapping!: Partial<Record<MatchOutcomeSide, string>>;

  @Column('varchar', { nullable: true })
  region!: string | null;

  @Column('varchar', { nullable: true })
  league!: string | null;

  @Column('varchar', { nullable: true })
  startTime!: string | null;
}
