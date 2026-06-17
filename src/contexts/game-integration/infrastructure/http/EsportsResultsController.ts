import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SyncResultsSummaryDto } from './upcoming.dto';
import { SyncFeedResults, SyncResultsSummary } from '../../application/SyncFeedResults';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/roles.guard';
import { Roles } from '../../../../shared/auth/roles.decorator';

@ApiTags('game-integration')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
@ApiForbiddenResponse({ description: 'Réservé au rôle MANAGER' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER')
@Controller('game-integration')
export class EsportsResultsController {
  constructor(private readonly syncFeedResults: SyncFeedResults) {}

  @Post('esports/sync-results')
  @HttpCode(200)
  @ApiOkResponse({
    type: SyncResultsSummaryDto,
    description:
      'Récupère les résultats des matchs ingérés terminés et règle marchés + paris ' +
      '(exactly-once : un rejeu ne re-crédite pas). Rate-limit léger côté serveur.',
  })
  syncResults(): Promise<SyncResultsSummary> {
    return this.syncFeedResults.execute();
  }
}
