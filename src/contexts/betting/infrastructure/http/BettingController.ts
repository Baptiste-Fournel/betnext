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
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PlaceBetCommand } from '../../application/PlaceBetCommand';
import { PlaceBetOutput } from '../../application/PlaceBet';
import { GetBetQuery } from '../../application/GetBetQuery';
import { BetView } from '../../application/GetBetHandler';

interface PlaceBetBody {
  userId?: unknown;
  outcomeId?: unknown;
  stake?: unknown;
}

/**
 * Adapter HTTP entrant. ÉCRITURE : POST /bets via CommandBus, `Idempotency-Key` REQUIS (anti
 * double-débit au retry). LECTURE (BET-10) : GET /bets/:id via QueryBus → données joueur lues sur
 * Postgres (read-your-writes : le pari posé est visible immédiatement). La cote courante publique
 * se lit ailleurs (GET /odds/:id, read-model Redis), jamais sur la base d'écriture.
 */
@Controller('bets')
export class BettingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @HttpCode(201)
  place(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: PlaceBetBody,
  ): Promise<PlaceBetOutput> {
    if (!idempotencyKey || idempotencyKey.trim() === '') {
      throw new BadRequestException("Header 'Idempotency-Key' requis");
    }
    const { userId, outcomeId, stake } = this.validate(body);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ userId, outcomeId, stake }))
      .digest('hex');
    return this.commandBus.execute<PlaceBetCommand, PlaceBetOutput>(
      new PlaceBetCommand(userId, outcomeId, stake, idempotencyKey.trim(), requestHash),
    );
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<BetView> {
    const bet = await this.queryBus.execute<GetBetQuery, BetView | null>(new GetBetQuery(id));
    if (!bet) {
      throw new NotFoundException(`Pari ${id} introuvable`);
    }
    return bet;
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
