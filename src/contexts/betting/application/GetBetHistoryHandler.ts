import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBetHistoryQuery } from './GetBetHistoryQuery';
import { BET_REPOSITORY, BetRepository } from './ports/BetRepository';

/** Une transition du pari, depuis le JOURNAL append-only (pas une chronologie fabriquée). */
export interface BetEventView {
  seq: number;
  type: string;
  occurredAt: string;
}

/**
 * Lit la TIMELINE d'un pari depuis le journal d'événements (BetPlaced → BetWon/BetLost/BetVoided).
 * Le front l'AFFICHE ; il ne la reconstruit pas. Rend l'Event Sourcing (ADR-005) visible côté UI.
 */
@QueryHandler(GetBetHistoryQuery)
export class GetBetHistoryHandler implements IQueryHandler<
  GetBetHistoryQuery,
  BetEventView[] | null
> {
  constructor(@Inject(BET_REPOSITORY) private readonly bets: BetRepository) {}

  async execute(query: GetBetHistoryQuery): Promise<BetEventView[] | null> {
    const bet = await this.bets.findById(query.betId);
    if (!bet || bet.userId !== query.requesterUserId) {
      // Anti-IDOR : la timeline d'un pari non possédé est indistincte de l'inexistant.
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
