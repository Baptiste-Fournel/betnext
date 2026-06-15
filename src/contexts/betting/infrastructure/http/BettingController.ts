import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { PlaceBetCommand } from '../../application/PlaceBetCommand';
import { PlaceBetOutput } from '../../application/PlaceBet';

interface PlaceBetBody {
  userId?: unknown;
  outcomeId?: unknown;
  stake?: unknown;
}

/**
 * Adapter HTTP entrant. Validation de FORME → 400. Les invariants métier (DomainError levée par
 * le domaine) sont mappés en 422 par le filtre global DomainExceptionFilter — pas de try/catch ici.
 */
@Controller('bets')
export class BettingController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @HttpCode(201)
  place(@Body() body: PlaceBetBody): Promise<PlaceBetOutput> {
    return this.commandBus.execute<PlaceBetCommand, PlaceBetOutput>(this.toCommand(body));
  }

  private toCommand(body: PlaceBetBody): PlaceBetCommand {
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const outcomeId = typeof body.outcomeId === 'string' ? body.outcomeId.trim() : '';
    const stake = typeof body.stake === 'number' ? body.stake : NaN;

    const errors: string[] = [];
    if (!userId) errors.push('userId (string non vide) requis');
    if (!outcomeId) errors.push('outcomeId (string non vide) requis');
    if (!Number.isFinite(stake)) errors.push('stake (nombre) requis');
    if (errors.length > 0) throw new BadRequestException(errors);

    return new PlaceBetCommand(userId, outcomeId, stake);
  }
}
