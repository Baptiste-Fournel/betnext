import { createHash } from 'node:crypto';
import { BadRequestException, Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { PlaceBetCommand } from '../../application/PlaceBetCommand';
import { PlaceBetOutput } from '../../application/PlaceBet';

interface PlaceBetBody {
  userId?: unknown;
  outcomeId?: unknown;
  stake?: unknown;
}

/**
 * Adapter HTTP entrant. `Idempotency-Key` REQUIS (absent → 400) : ferme la fenêtre de double-débit
 * au retry HTTP. Le hash du corps permet de détecter « même clé, corps différent » → 409 (via le
 * filtre global). Forme du corps invalide → 400 ; invariant métier → 422.
 */
@Controller('bets')
export class BettingController {
  constructor(private readonly commandBus: CommandBus) {}

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
