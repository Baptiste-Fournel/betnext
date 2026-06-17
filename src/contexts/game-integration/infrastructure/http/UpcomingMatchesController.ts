import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListUpcomingMatches, UpcomingMatch } from '../../application/ListUpcomingMatches';
import { UpcomingMatchDto } from './upcoming.dto';

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
