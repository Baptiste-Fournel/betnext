import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { ODDS_READ_MODEL, OddsReadModel } from './OddsReadModel';

class CurrentOddsDto {
  @ApiProperty({ example: 'lol-finale-a' })
  outcomeId!: string;
  @ApiProperty({ example: 2.0 })
  odds!: number;
}

@ApiTags('odds')
@Controller('odds')
export class OddsReadController {
  constructor(@Inject(ODDS_READ_MODEL) private readonly readModel: OddsReadModel) {}

  @Get(':outcomeId')
  @ApiParam({ name: 'outcomeId', example: 'lol-finale-a' })
  @ApiOkResponse({ type: CurrentOddsDto, description: 'Cote courante (read-model)' })
  @ApiNotFoundResponse({ description: 'Read-model froid : aucune cote encore projetée' })
  async current(@Param('outcomeId') outcomeId: string): Promise<CurrentOddsDto> {
    const odds = await this.readModel.current(outcomeId);
    if (odds == null) {
      throw new NotFoundException(`Aucune cote disponible pour ${outcomeId} (read-model froid).`);
    }
    return { outcomeId, odds };
  }
}
