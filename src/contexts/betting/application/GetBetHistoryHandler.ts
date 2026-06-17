import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBetHistoryQuery } from './GetBetHistoryQuery';
import { BET_REPOSITORY, BetRepository } from './ports/BetRepository';

export interface BetEventView {
  seq: number;
  type: string;
  occurredAt: string;
}

@QueryHandler(GetBetHistoryQuery)
export class GetBetHistoryHandler implements IQueryHandler<
  GetBetHistoryQuery,
  BetEventView[] | null
> {
  constructor(@Inject(BET_REPOSITORY) private readonly bets: BetRepository) {}

  async execute(query: GetBetHistoryQuery): Promise<BetEventView[] | null> {
    const bet = await this.bets.findById(query.betId);
    if (!bet || bet.userId !== query.requesterUserId) {
      return null;
    }
    const events = await this.bets.history(query.betId);
    return events.map((event) => ({
      seq: event.seq,
      type: event.type,
      occurredAt: event.occurredAt.toISOString(),
    }));
  }
}
