import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListBetsQuery } from './ListBetsQuery';
import { BetView } from './GetBetHandler';
import { BET_REPOSITORY, BetRepository } from './ports/BetRepository';

@QueryHandler(ListBetsQuery)
export class ListBetsHandler implements IQueryHandler<ListBetsQuery, BetView[]> {
  constructor(@Inject(BET_REPOSITORY) private readonly bets: BetRepository) {}

  async execute(): Promise<BetView[]> {
    const bets = await this.bets.list();
    return bets.map((bet) => ({
      betId: bet.id,
      userId: bet.userId,
      outcomeId: bet.outcomeId,
      stake: bet.stake,
      lockedOdds: bet.lockedOdds.value,
      potentialGain: bet.potentialGain,
      status: bet.status,
    }));
  }
}
