import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBetQuery } from './GetBetQuery';
import { BET_REPOSITORY, BetRepository } from './ports/BetRepository';

export interface BetView {
  betId: string;
  userId: string;
  outcomeId: string;
  stake: number;
  lockedOdds: number;
  potentialGain: number;
  status: string;
}

@QueryHandler(GetBetQuery)
export class GetBetHandler implements IQueryHandler<GetBetQuery, BetView | null> {
  constructor(@Inject(BET_REPOSITORY) private readonly bets: BetRepository) {}

  async execute(query: GetBetQuery): Promise<BetView | null> {
    const bet = await this.bets.findById(query.betId);
    if (!bet || bet.userId !== query.requesterUserId) {
      return null;
    }
    return {
      betId: bet.id,
      userId: bet.userId,
      outcomeId: bet.outcomeId,
      stake: bet.stake,
      lockedOdds: bet.lockedOdds.value,
      potentialGain: bet.potentialGain,
      status: bet.status,
    };
  }
}
