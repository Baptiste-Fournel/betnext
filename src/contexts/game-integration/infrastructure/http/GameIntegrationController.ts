import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RegisterMatchLink } from '../../application/RegisterMatchLink';
import { SyncMatchResult, SyncResult } from '../../application/SyncMatchResult';
import { MatchLink } from '../../application/ports/MatchLinkStore';
import { MatchOutcomeSide } from '../../domain/MatchReport';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/roles.guard';
import { Roles } from '../../../../shared/auth/roles.decorator';

class OutcomeMappingDto {
  @ApiPropertyOptional({ example: 'mkt-demo-lol-1', description: 'issue gagnante si HOME gagne' })
  HOME?: string;
  @ApiPropertyOptional({ example: 'mkt-demo-lol-2', description: 'issue gagnante si AWAY gagne' })
  AWAY?: string;
  @ApiPropertyOptional({
    example: 'mkt-demo-lol-3',
    description: 'issue si match nul (sinon annulé)',
  })
  DRAW?: string;
}
class RegisterMatchLinkRequest {
  @ApiProperty({ example: 'EUW1_1234567890' })
  matchId!: string;
  @ApiProperty({ type: [String], example: ['mkt-demo-lol-1', 'mkt-demo-lol-2', 'mkt-demo-lol-3'] })
  outcomes!: string[];
  @ApiProperty({ type: OutcomeMappingDto })
  mapping!: OutcomeMappingDto;
}
class MatchLinkDto {
  @ApiProperty({ example: 'EUW1_1234567890' })
  matchId!: string;
  @ApiProperty({ type: [String] })
  outcomes!: string[];
  @ApiProperty({ type: OutcomeMappingDto })
  mapping!: OutcomeMappingDto;
}
class SettlementSummaryDto {
  @ApiProperty({ example: 1 })
  settled!: number;
  @ApiProperty({ example: 1 })
  won!: number;
  @ApiProperty({ example: 0 })
  lost!: number;
  @ApiProperty({ example: 0 })
  voided!: number;
  @ApiProperty({ example: 0 })
  failed!: number;
}
class SyncResultDto {
  @ApiProperty({ example: 'EUW1_1234567890' })
  matchId!: string;
  @ApiProperty({ example: 'SETTLED', enum: ['PENDING', 'SETTLED'] })
  status!: string;
  @ApiPropertyOptional({ example: 'WON_OUTCOME', enum: ['WON_OUTCOME', 'VOIDED'] })
  resolution?: string;
  @ApiPropertyOptional({ example: 'mkt-demo-lol-1' })
  winningOutcomeId?: string;
  @ApiPropertyOptional({ type: SettlementSummaryDto })
  summary?: SettlementSummaryDto;
}

interface RegisterBody {
  matchId?: unknown;
  outcomes?: unknown;
  mapping?: unknown;
}

/**
 * Intégration jeu (Riot) — endpoints d'ADMINISTRATION réservés au rôle MANAGER. (1) Lier un match à un
 * marché + mapping côté→issue ; (2) DÉCLENCHER la synchro d'un résultat → règlement auto via la
 * couture existante (exactly-once). Mécanisme « déclenché » (simple, démontrable) ; un scheduler
 * appellerait le même use-case.
 */
@ApiTags('game-integration')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
@ApiForbiddenResponse({ description: 'Réservé au rôle MANAGER' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER')
@Controller('game-integration')
export class GameIntegrationController {
  constructor(
    private readonly registerMatchLink: RegisterMatchLink,
    private readonly syncMatchResult: SyncMatchResult,
  ) {}

  @Post('matches')
  @HttpCode(200)
  @ApiBody({ type: RegisterMatchLinkRequest })
  @ApiOkResponse({ type: MatchLinkDto, description: 'Lien match↔marché enregistré' })
  @ApiBadRequestResponse({ description: 'Corps invalide (matchId/outcomes/mapping)' })
  link(@Body() body: RegisterBody): Promise<MatchLink> {
    const matchId = typeof body.matchId === 'string' ? body.matchId : '';
    const outcomes =
      Array.isArray(body.outcomes) && body.outcomes.every((o) => typeof o === 'string')
        ? (body.outcomes as string[])
        : null;
    if (!matchId.trim() || outcomes === null) {
      throw new BadRequestException('matchId (string) et outcomes (string[]) requis');
    }
    const mapping = this.parseMapping(body.mapping);
    return this.registerMatchLink.execute({ matchId, outcomes, mapping });
  }

  @Post('matches/:matchId/sync')
  @HttpCode(200)
  @ApiParam({ name: 'matchId' })
  @ApiOkResponse({ type: SyncResultDto, description: 'Résultat synchronisé (réglé si match fini)' })
  sync(@Param('matchId') matchId: string): Promise<SyncResult> {
    return this.syncMatchResult.execute(matchId);
  }

  private parseMapping(raw: unknown): Partial<Record<MatchOutcomeSide, string>> {
    const mapping: Partial<Record<MatchOutcomeSide, string>> = {};
    if (raw && typeof raw === 'object') {
      const source = raw as Record<string, unknown>;
      for (const side of ['HOME', 'AWAY', 'DRAW'] as const) {
        if (typeof source[side] === 'string') {
          mapping[side] = source[side] as string;
        }
      }
    }
    return mapping;
  }
}
