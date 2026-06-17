import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PlayerStatsQuery } from './PlayerStatsQuery';
import { BET_REPOSITORY, BetRepository } from './ports/BetRepository';
import { Bet } from '../domain/Bet';
import { BetStatus } from '../domain/BetStatus';

export interface PlayerStatsView {
  totalBets: number;
  pending: number;
  won: number;
  lost: number;
  voided: number;
  totalStaked: number;
  netResult: number;
  winRate: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const round4 = (value: number): number => Math.round(value * 10000) / 10000;

@QueryHandler(PlayerStatsQuery)
export class GetPlayerStatsHandler implements IQueryHandler<PlayerStatsQuery, PlayerStatsView> {
  constructor(@Inject(BET_REPOSITORY) private readonly bets: BetRepository) {}

  async execute(query: PlayerStatsQuery): Promise<PlayerStatsView> {
    const bets = await this.bets.listByUser(query.userId);
    return this.aggregate(bets);
  }

  private aggregate(bets: Bet[]): PlayerStatsView {
    const stats: PlayerStatsView = {
      totalBets: bets.length,
      pending: 0,
      won: 0,
      lost: 0,
      voided: 0,
      totalStaked: 0,
      netResult: 0,
      winRate: 0,
    };
    let totalStaked = 0;
    let netResult = 0;
    for (const bet of bets) {
      totalStaked += bet.stake;
      switch (bet.status) {
        case BetStatus.Won:
          stats.won += 1;
          netResult += bet.potentialGain - bet.stake;
          break;
        case BetStatus.Lost:
          stats.lost += 1;
          netResult -= bet.stake;
          break;
        case BetStatus.Void:
        case BetStatus.Refunded:
          stats.voided += 1;
          break;
        default:
          stats.pending += 1;
      }
    }
    const decided = stats.won + stats.lost;
    stats.totalStaked = round2(totalStaked);
    stats.netResult = round2(netResult);
    stats.winRate = decided === 0 ? 0 : round4(stats.won / decided);
    return stats;
  }
}
