import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListUpcomingMatches, UpcomingMatch } from '../../application/ListUpcomingMatches';
import { UpcomingMatchDto } from './upcoming.dto';

// Contrôleur PUBLIC séparé : la liste des matchs pro à venir (ingérés par le feed BET-30) sert
// au front joueur pour le badge ligue + le kickoff. Isolé du contrôleur sécurisé pour ne pas
// affaiblir la garde @Roles('MANAGER') des endpoints d'écriture.
@ApiTags('game-integration')
@Controller('game-integration')
export class UpcomingMatchesController {
  constructor(private readonly listUpcomingMatches: ListUpcomingMatches) {}

  @Get('upcoming')
  @ApiOkResponse({
    type: [UpcomingMatchDto],
    description: 'Matchs pro à venir ingérés (matchId, marketId, ligue, kickoff) — PUBLIC',
  })
  list(): Promise<UpcomingMatch[]> {
    return this.listUpcomingMatches.execute();
  }
}
