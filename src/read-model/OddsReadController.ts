import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ODDS_READ_MODEL, OddsReadModel } from './OddsReadModel';
import { openingOdds } from '../shared-kernel/domain/OpeningOdds';

class CurrentOddsDto {
  @ApiProperty({ example: 'lol-finale-a' })
  outcomeId!: string;
  @ApiProperty({ example: 2.0 })
  odds!: number;
  @ApiProperty({
    example: true,
    description:
      "true = cote d'ouverture (aucun volume encore), false = cote pilotée par le volume",
  })
  opening!: boolean;
}

@ApiTags('odds')
@Controller('odds')
export class OddsReadController {
  constructor(@Inject(ODDS_READ_MODEL) private readonly readModel: OddsReadModel) {}

  @Get(':outcomeId')
  @ApiParam({ name: 'outcomeId', example: 'lol-finale-a' })
  @ApiOkResponse({
    type: CurrentOddsDto,
    description: "Cote courante (read-model) ou cote d'ouverture si aucun volume",
  })
  async current(@Param('outcomeId') outcomeId: string): Promise<CurrentOddsDto> {
    const odds = await this.readModel.current(outcomeId);
    return odds == null
      ? { outcomeId, odds: openingOdds().value, opening: true }
      : { outcomeId, odds, opening: false };
  }
}
