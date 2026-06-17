import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PlaceBetCommand } from '../../application/PlaceBetCommand';
import { GetBetQuery } from '../../application/GetBetQuery';
import { ListBetsQuery } from '../../application/ListBetsQuery';
import { GetBetHistoryQuery } from '../../application/GetBetHistoryQuery';
import { BetView } from '../../application/GetBetHandler';
import { BetEventView } from '../../application/GetBetHistoryHandler';
import { JwtAuthGuard } from '../../../../shared/auth/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator';
import { AuthUser } from '../../../../shared/auth/auth-user';

class PlaceBetRequest {
  @ApiProperty({ example: 'lol-finale-a' })
  outcomeId!: string;
  @ApiProperty({ example: 20, minimum: 0, description: 'Mise (strictement positive)' })
  stake!: number;
}
class PlaceBetResponse {
  @ApiProperty({ example: '3f9c0b2e-...' })
  betId!: string;
  @ApiProperty({ example: 2.0, description: 'Cote figée à la pose' })
  lockedOdds!: number;
  @ApiProperty({ example: 40 })
  potentialGain!: number;
  @ApiPropertyOptional({ example: true, description: "Cote d'ouverture (read-model froid)" })
  pricingProvisional?: boolean;
}
/** Vue d'un pari (snapshot autoritatif). */
class BetViewDto {
  @ApiProperty()
  betId!: string;
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
  @ApiProperty({ example: 'lol-finale-a' })
  outcomeId!: string;
  @ApiProperty({ example: 20 })
  stake!: number;
  @ApiProperty({ example: 2.0 })
  lockedOdds!: number;
  @ApiProperty({ example: 40 })
  potentialGain!: number;
  @ApiProperty({
    example: 'PENDING',
    enum: ['PENDING', 'WON', 'LOST', 'VOID', 'COMPENSATING', 'REFUNDED'],
  })
  status!: string;
}
/** Une transition de la timeline (journal append-only). */
class BetEventDto {
  @ApiProperty({ example: 1 })
  seq!: number;
  @ApiProperty({ example: 'BetPlaced', enum: ['BetPlaced', 'BetWon', 'BetLost', 'BetVoided'] })
  type!: string;
  @ApiProperty({ example: '2026-06-16T10:00:00.000Z' })
  occurredAt!: string;
}

interface PlaceBetBody {
  outcomeId?: unknown;
  stake?: unknown;
}

/**
 * Adapter HTTP des paris — AUTHENTIFIÉ (BET-20). Le `userId` vient TOUJOURS du token (jamais du
 * corps), donc aucune usurpation. LECTURE scopée anti-IDOR : un joueur ne voit que SES paris ; un id
 * d'autrui (ou inconnu) → 404 indistinct. ÉCRITURE : POST /bets (CommandBus, `Idempotency-Key`).
 */
@ApiTags('bets')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token Bearer requis/invalide' })
@UseGuards(JwtAuthGuard)
@Controller('bets')
export class BettingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clé par tentative, réutilisée au retry HTTP (anti double-débit).',
  })
  @ApiBody({ type: PlaceBetRequest })
  @ApiCreatedResponse({ type: PlaceBetResponse, description: 'Pari posé (cote figée)' })
  @ApiConflictResponse({ description: 'Même Idempotency-Key réutilisée avec un corps différent' })
  place(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: PlaceBetBody,
  ): Promise<PlaceBetResponse> {
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      throw new BadRequestException("Header 'Idempotency-Key' requis");
    }
    const { outcomeId, stake } = this.validate(body);
    // userId = identité authentifiée (token), JAMAIS un champ client → pas d'usurpation.
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ userId: user.userId, outcomeId, stake }))
      .digest('hex');
    return this.commandBus.execute<PlaceBetCommand, PlaceBetResponse>(
      new PlaceBetCommand(user.userId, outcomeId, stake, idempotencyKey.trim(), requestHash),
    );
  }

  @Get()
  @ApiOkResponse({
    type: [BetViewDto],
    description: "Paris de l'utilisateur authentifié uniquement",
  })
  list(@CurrentUser() user: AuthUser): Promise<BetViewDto[]> {
    return this.queryBus.execute<ListBetsQuery, BetView[]>(new ListBetsQuery(user.userId));
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: BetViewDto })
  @ApiNotFoundResponse({ description: 'Pari introuvable (ou non possédé — anti-IDOR)' })
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<BetViewDto> {
    const bet = await this.queryBus.execute<GetBetQuery, BetView | null>(
      new GetBetQuery(id, user.userId),
    );
    if (!bet) {
      throw new NotFoundException(`Pari ${id} introuvable`);
    }
    return bet;
  }

  @Get(':id/events')
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: [BetEventDto], description: 'Timeline du pari (journal append-only)' })
  @ApiNotFoundResponse({ description: 'Pari introuvable (ou non possédé — anti-IDOR)' })
  async events(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<BetEventDto[]> {
    const events = await this.queryBus.execute<GetBetHistoryQuery, BetEventView[] | null>(
      new GetBetHistoryQuery(id, user.userId),
    );
    if (events === null) {
      throw new NotFoundException(`Pari ${id} introuvable`);
    }
    return events;
  }

  private validate(body: PlaceBetBody): { outcomeId: string; stake: number } {
    const outcomeId = typeof body.outcomeId === 'string' ? body.outcomeId.trim() : '';
    const stake = typeof body.stake === 'number' ? body.stake : NaN;

    const errors: string[] = [];
    if (!outcomeId) errors.push('outcomeId (string non vide) requis');
    if (!Number.isFinite(stake)) errors.push('stake (nombre) requis');
    if (errors.length > 0) throw new BadRequestException(errors);

    return { outcomeId, stake };
  }
}
