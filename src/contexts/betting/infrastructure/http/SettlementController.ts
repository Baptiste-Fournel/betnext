import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { SettleMarketCommand } from '../../application/SettleMarketCommand';
import { SettleMarketResult } from '../../application/SettleMarket';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/auth/roles.guard';
import { Roles } from '../../../../shared/auth/roles.decorator';

class SettleMarketRequest {
  @ApiProperty({ type: [String], example: ['lol-finale-a', 'lol-finale-b', 'lol-finale-draw'] })
  outcomes!: string[];
  @ApiPropertyOptional({ type: String, nullable: true, example: 'lol-finale-a' })
  winningOutcomeId?: string | null;
  @ApiPropertyOptional({ example: false, description: 'true = annulation (remboursement)' })
  voided?: boolean;
  @ApiPropertyOptional({ example: 'WINNING_OUTCOME' })
  strategyKey?: string;
}
class SettleMarketResultDto {
  @ApiProperty({ example: 2 })
  settled!: number;
  @ApiProperty({ example: 0 })
  failed!: number;
  @ApiProperty({ example: 1 })
  won!: number;
  @ApiProperty({ example: 1 })
  lost!: number;
  @ApiProperty({ example: 0 })
  voided!: number;
  @ApiProperty({ type: [String], example: [] })
  failedBetIds!: string[];
}

interface SettleBody {
  outcomes?: unknown;
  winningOutcomeId?: unknown;
  voided?: unknown;
  strategyKey?: unknown;
}

@ApiTags('markets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER')
@Controller('markets')
export class SettlementController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('settle')
  @HttpCode(200)
  @ApiBody({ type: SettleMarketRequest })
  @ApiOkResponse({
    type: SettleMarketResultDto,
    description: 'Règlement effectué (comptes par statut) — MANAGER',
  })
  @ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
  @ApiForbiddenResponse({ description: 'Réservé au rôle MANAGER' })
  @ApiBadRequestResponse({ description: 'outcomes vide, ou winningOutcomeId manquant sans voided' })
  settle(@Body() body: SettleBody): Promise<SettleMarketResultDto> {
    const { outcomes, winningOutcomeId, voided, strategyKey } = this.validate(body);
    return this.commandBus.execute<SettleMarketCommand, SettleMarketResult>(
      new SettleMarketCommand(outcomes, winningOutcomeId, voided, strategyKey),
    );
  }

  private validate(body: SettleBody): {
    outcomes: string[];
    winningOutcomeId: string | null;
    voided: boolean;
    strategyKey?: string;
  } {
    const outcomes =
      Array.isArray(body.outcomes) &&
      body.outcomes.every((o) => typeof o === 'string' && o.trim() !== '')
        ? (body.outcomes as string[])
        : [];
    const voided = body.voided === true;
    const winningOutcomeId =
      typeof body.winningOutcomeId === 'string' && body.winningOutcomeId.trim() !== ''
        ? body.winningOutcomeId.trim()
        : null;
    const strategyKey =
      typeof body.strategyKey === 'string' && body.strategyKey.trim() !== ''
        ? body.strategyKey.trim()
        : undefined;

    const errors: string[] = [];
    if (outcomes.length === 0) errors.push('outcomes (string[] non vide) requis');
    if (!voided && winningOutcomeId === null)
      errors.push('winningOutcomeId requis si voided=false');
    if (!voided && winningOutcomeId !== null && !outcomes.includes(winningOutcomeId))
      errors.push('winningOutcomeId doit faire partie de outcomes');
    if (errors.length > 0) throw new BadRequestException(errors);

    return { outcomes, winningOutcomeId, voided, strategyKey };
  }
}
