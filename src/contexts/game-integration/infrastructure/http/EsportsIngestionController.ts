import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IngestSummaryDto } from './upcoming.dto';
import { IngestSummary, IngestUpcomingMatches } from '../../application/IngestUpcomingMatches';
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
export class EsportsIngestionController {
  constructor(private readonly ingestUpcomingMatches: IngestUpcomingMatches) {}

  @Post('esports/ingest')
  @HttpCode(200)
  @ApiOkResponse({
    type: IngestSummaryDto,
    description:
      'Ingère les matchs LoL pro à venir (source live ou fixtures en mode dégradé) en marchés ' +
      'bettables. Idempotent : un re-pull ne duplique pas les marchés.',
  })
  ingest(): Promise<IngestSummary> {
    return this.ingestUpcomingMatches.execute();
  }
}
