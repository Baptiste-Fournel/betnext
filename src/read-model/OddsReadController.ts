import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { ODDS_READ_MODEL, OddsReadModel } from './OddsReadModel';

/**
 * Lecture de la cote COURANTE servie depuis le read-model (Redis), JAMAIS depuis la base d'écriture.
 * Cold cache (aucun OddsUpdated projeté) → 404 explicite : la cohérence éventuelle est observable.
 */
@Controller('odds')
export class OddsReadController {
  constructor(@Inject(ODDS_READ_MODEL) private readonly readModel: OddsReadModel) {}

  @Get(':outcomeId')
  async current(
    @Param('outcomeId') outcomeId: string,
  ): Promise<{ outcomeId: string; odds: number }> {
    const odds = await this.readModel.current(outcomeId);
    if (odds == null) {
      throw new NotFoundException(`Aucune cote disponible pour ${outcomeId} (read-model froid).`);
    }
    return { outcomeId, odds };
  }
}
