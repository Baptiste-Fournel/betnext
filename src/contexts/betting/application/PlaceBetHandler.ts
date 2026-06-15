import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlaceBetCommand } from './PlaceBetCommand';
import { PlaceBet, PlaceBetOutput } from './PlaceBet';

/**
 * Adapter CQRS (ADR-006, chemin d'écriture). Handler FIN : il délègue au use case pur
 * `PlaceBet`. Le domaine et le use case restent sans dépendance framework ; seul ce handler
 * connaît @nestjs/cqrs. Une commande = une intention de mutation.
 */
@CommandHandler(PlaceBetCommand)
export class PlaceBetHandler implements ICommandHandler<PlaceBetCommand, PlaceBetOutput> {
  constructor(private readonly placeBet: PlaceBet) {}

  execute(command: PlaceBetCommand): Promise<PlaceBetOutput> {
    return this.placeBet.execute({
      userId: command.userId,
      outcomeId: command.outcomeId,
      stake: command.stake,
    });
  }
}
