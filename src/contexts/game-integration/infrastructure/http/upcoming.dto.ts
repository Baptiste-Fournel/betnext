import { ApiProperty } from '@nestjs/swagger';

export class UpcomingMatchDto {
  @ApiProperty({ example: '115570934355614497', description: 'id externe du match (clé du lien)' })
  matchId!: string;
  @ApiProperty({ example: 'mkt-1bb3ce76', description: 'marché bettable créé pour ce match' })
  marketId!: string;
  @ApiProperty({
    type: String,
    example: 'MSI',
    nullable: true,
    description: 'ligue du match à venir (badge)',
  })
  league!: string | null;
  @ApiProperty({
    type: String,
    example: '2026-06-28T03:00:00Z',
    nullable: true,
    description: 'kickoff ISO 8601 du match à venir',
  })
  startTime!: string | null;
}

export class IngestSummaryDto {
  @ApiProperty({ example: 'live', enum: ['live', 'fixtures'], description: 'source du feed' })
  source!: string;
  @ApiProperty({ example: 8, description: 'matchs à venir reçus de la source' })
  total!: number;
  @ApiProperty({ example: 6, description: 'nouveaux marchés créés' })
  ingested!: number;
  @ApiProperty({ example: 2, description: 'déjà ingérés (idempotent) — non dupliqués' })
  skipped!: number;
  @ApiProperty({ example: 0, description: 'matchs ignorés pour données invalides' })
  failed!: number;
  @ApiProperty({ type: [String], description: 'ids des marchés créés' })
  marketIds!: string[];
}
