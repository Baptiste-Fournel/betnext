import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FeaturedOutcomeInputDto {
  @ApiProperty({ example: 'Victoire Blue side' })
  label!: string;
  @ApiProperty({ example: 'HOME', enum: ['HOME', 'AWAY', 'DRAW'] })
  side!: string;
}

export class FeatureRiotMatchRequest {
  @ApiProperty({ example: 'Riot Featured — Blue vs Red' })
  name!: string;
  @ApiProperty({ example: 'LoL' })
  game!: string;
  @ApiProperty({ example: 'EUW1_7437325115' })
  matchId!: string;
  @ApiPropertyOptional({ example: 'EUW', description: 'région (métadonnée ; routing europe)' })
  region?: string;
  @ApiProperty({ type: [FeaturedOutcomeInputDto] })
  outcomes!: FeaturedOutcomeInputDto[];
}

export class FeaturedSideMappingDto {
  @ApiPropertyOptional({ example: 'mkt-featured-euw1-7437325115-1' })
  HOME?: string;
  @ApiPropertyOptional({ example: 'mkt-featured-euw1-7437325115-2' })
  AWAY?: string;
  @ApiPropertyOptional({ example: 'mkt-featured-euw1-7437325115-3' })
  DRAW?: string;
}

export class FeaturedMatchDto {
  @ApiProperty({ example: 'EUW1_7437325115' })
  matchId!: string;
  @ApiProperty({ example: 'mkt-featured-euw1-7437325115' })
  marketId!: string;
  @ApiProperty({ type: String, example: 'EUW', nullable: true })
  region!: string | null;
  @ApiProperty({ type: [String] })
  outcomes!: string[];
  @ApiProperty({ type: FeaturedSideMappingDto })
  mapping!: FeaturedSideMappingDto;
}
