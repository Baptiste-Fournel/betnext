import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlaceBetCommand } from './PlaceBetCommand';
import { IdempotentPlaceBet } from './IdempotentPlaceBet';
import { PlaceBetOutput } from './PlaceBet';

/** Adapter CQRS : délègue au use case idempotent (ADR-006, chemin d'écriture). */
@CommandHandler(PlaceBetCommand)
export class PlaceBetHandler implements ICommandHandler<PlaceBetCommand, PlaceBetOutput> {
  constructor(private readonly placeBet: IdempotentPlaceBet) {}

  execute(command: PlaceBetCommand): Promise<PlaceBetOutput> {
    return this.placeBet.execute({
      userId: command.userId,
      outcomeId: command.outcomeId,
      stake: command.stake,
      idempotencyKey: command.idempotencyKey,
      requestHash: command.requestHash,
    });
  }
}
