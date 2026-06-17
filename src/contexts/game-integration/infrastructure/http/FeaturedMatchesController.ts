import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListFeaturedMatches } from '../../application/ListFeaturedMatches';
import { FeaturedMatch } from '../../application/FeatureRiotMatch';
import { FeaturedMatchDto } from './featured.dto';

// Contrôleur PUBLIC séparé : la liste des matchs featured n'est pas réservée au MANAGER
// (le joueur s'en sert pour marquer « Featured · Riot »). Isolé du contrôleur sécurisé
// pour ne pas affaiblir la garde @Roles('MANAGER') de classe des endpoints d'écriture.
@ApiTags('game-integration')
@Controller('game-integration')
export class FeaturedMatchesController {
  constructor(private readonly listFeaturedMatches: ListFeaturedMatches) {}

  @Get('featured')
  @ApiOkResponse({
    type: [FeaturedMatchDto],
    description: 'Matchs Riot mis en avant (matchId, région, marketId, mapping) — PUBLIC',
  })
  list(): Promise<FeaturedMatch[]> {
    return this.listFeaturedMatches.execute();
  }
}
