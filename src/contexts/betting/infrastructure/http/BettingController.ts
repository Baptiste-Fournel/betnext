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
} from '@nestjs/common';
import {
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
} from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PlaceBetCommand } from '../../application/PlaceBetCommand';
import { GetBetQuery } from '../../application/GetBetQuery';
import { ListBetsQuery } from '../../application/ListBetsQuery';
import { GetBetHistoryQuery } from '../../application/GetBetHistoryQuery';
import { BetView } from '../../application/GetBetHandler';
import { BetEventView } from '../../application/GetBetHistoryHandler';

class PlaceBetRequest {
  @ApiProperty({ example: 'demo-player' })
  userId!: string;
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
  userId?: unknown;
  outcomeId?: unknown;
  stake?: unknown;
}

/**
 * Adapter HTTP. ÉCRITURE : POST /bets (CommandBus, `Idempotency-Key` requis). LECTURE (QueryBus) :
 * GET /bets (liste — NON scopée utilisateur tant qu'Identity n'existe pas, dette tracée),
 * GET /bets/:id (read-your-writes), GET /bets/:id/events (timeline / Event Sourcing visible).
 */
@ApiTags('bets')
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
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: PlaceBetBody,
  ): Promise<PlaceBetResponse> {
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      throw new BadRequestException("Header 'Idempotency-Key' requis");
    }
    const { userId, outcomeId, stake } = this.validate(body);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ userId, outcomeId, stake }))
      .digest('hex');
    return this.commandBus.execute<PlaceBetCommand, PlaceBetResponse>(
      new PlaceBetCommand(userId, outcomeId, stake, idempotencyKey.trim(), requestHash),
    );
  }

  @Get()
  @ApiOkResponse({
    type: [BetViewDto],
    description: 'Liste des paris (non scopée — voir dette Identity)',
  })
  list(): Promise<BetViewDto[]> {
    return this.queryBus.execute<ListBetsQuery, BetView[]>(new ListBetsQuery());
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: BetViewDto })
  @ApiNotFoundResponse({ description: 'Pari introuvable' })
  async get(@Param('id') id: string): Promise<BetViewDto> {
    const bet = await this.queryBus.execute<GetBetQuery, BetView | null>(new GetBetQuery(id));
    if (!bet) {
      throw new NotFoundException(`Pari ${id} introuvable`);
    }
    return bet;
  }

  @Get(':id/events')
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: [BetEventDto], description: 'Timeline du pari (journal append-only)' })
  events(@Param('id') id: string): Promise<BetEventDto[]> {
    return this.queryBus.execute<GetBetHistoryQuery, BetEventView[]>(new GetBetHistoryQuery(id));
  }

  private validate(body: PlaceBetBody): { userId: string; outcomeId: string; stake: number } {
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const outcomeId = typeof body.outcomeId === 'string' ? body.outcomeId.trim() : '';
    const stake = typeof body.stake === 'number' ? body.stake : NaN;

    const errors: string[] = [];
    if (!userId) errors.push('userId (string non vide) requis');
    if (!outcomeId) errors.push('outcomeId (string non vide) requis');
    if (!Number.isFinite(stake)) errors.push('stake (nombre) requis');
    if (errors.length > 0) throw new BadRequestException(errors);

    return { userId, outcomeId, stake };
  }
}
