import { GetPlayerStatsHandler } from './GetPlayerStatsHandler';
import { PlayerStatsQuery } from './PlayerStatsQuery';
import { BetRepository, StoredBetEvent } from './ports/BetRepository';
import { Bet } from '../domain/Bet';
import { BetStatus } from '../domain/BetStatus';
import { Odds } from '../../../shared-kernel/domain/Odds';

const betOf = (userId: string, status: BetStatus, stake: number, odds: number): Bet =>
  Bet.restore({
    id: `bet-${userId}-${status}-${stake}`,
    userId,
    outcomeId: 'o1',
    stake,
    lockedOdds: Odds.of(odds),
    potentialGain: Math.round(stake * odds * 100) / 100,
    status,
    createdAt: new Date(),
  });

class ScopedBetRepository implements BetRepository {
  constructor(private readonly bets: Bet[]) {}
  async save(): Promise<void> {}
  async findById(): Promise<Bet | null> {
    return null;
  }
  async list(): Promise<Bet[]> {
    return this.bets;
  }
  async listByUser(userId: string): Promise<Bet[]> {
    return this.bets.filter((bet) => bet.userId === userId);
  }
  async findPendingByOutcomes(): Promise<Bet[]> {
    return [];
  }
  async history(): Promise<StoredBetEvent[]> {
    return [];
  }
}

describe('GetPlayerStatsHandler (read-model stats, scoping anti-IDOR)', () => {
  it('shouldCountByStatus_WhenPlayerHasMixedBets', async () => {
    // Arrange
    const handler = new GetPlayerStatsHandler(
      new ScopedBetRepository([
        betOf('u1', BetStatus.Won, 20, 2),
        betOf('u1', BetStatus.Lost, 10, 3),
        betOf('u1', BetStatus.Void, 5, 2),
        betOf('u1', BetStatus.Pending, 8, 1.5),
      ]),
    );

    // Act
    const stats = await handler.execute(new PlayerStatsQuery('u1'));

    // Assert
    expect(stats).toMatchObject({ totalBets: 4, won: 1, lost: 1, voided: 1, pending: 1 });
  });

  it('shouldComputeTotalStakedAndNetResult_WhenPlayerHasSettledBets', async () => {
    // Arrange
    const handler = new GetPlayerStatsHandler(
      new ScopedBetRepository([
        betOf('u1', BetStatus.Won, 20, 2),
        betOf('u1', BetStatus.Lost, 10, 3),
        betOf('u1', BetStatus.Void, 5, 2),
        betOf('u1', BetStatus.Pending, 8, 1.5),
      ]),
    );

    // Act
    const stats = await handler.execute(new PlayerStatsQuery('u1'));

    // Assert
    expect(stats.totalStaked).toBe(43);
    expect(stats.netResult).toBe(10);
  });

  it('shouldComputeWinRateOverDecidedBets_WhenPlayerHasWonAndLost', async () => {
    // Arrange
    const handler = new GetPlayerStatsHandler(
      new ScopedBetRepository([
        betOf('u1', BetStatus.Won, 20, 2),
        betOf('u1', BetStatus.Won, 10, 2),
        betOf('u1', BetStatus.Lost, 10, 3),
        betOf('u1', BetStatus.Void, 5, 2),
        betOf('u1', BetStatus.Pending, 8, 1.5),
      ]),
    );

    // Act
    const stats = await handler.execute(new PlayerStatsQuery('u1'));

    // Assert
    expect(stats.winRate).toBeCloseTo(2 / 3, 4);
  });

  it('shouldReturnZeroes_WhenPlayerHasNoBets', async () => {
    // Arrange
    const handler = new GetPlayerStatsHandler(new ScopedBetRepository([]));

    // Act
    const stats = await handler.execute(new PlayerStatsQuery('newcomer'));

    // Assert
    expect(stats).toEqual({
      totalBets: 0,
      pending: 0,
      won: 0,
      lost: 0,
      voided: 0,
      totalStaked: 0,
      netResult: 0,
      winRate: 0,
    });
  });

  it('shouldNotDivideByZero_WhenNoDecidedBets', async () => {
    // Arrange
    const handler = new GetPlayerStatsHandler(
      new ScopedBetRepository([
        betOf('u1', BetStatus.Pending, 8, 1.5),
        betOf('u1', BetStatus.Void, 5, 2),
      ]),
    );

    // Act
    const stats = await handler.execute(new PlayerStatsQuery('u1'));

    // Assert
    expect(stats.winRate).toBe(0);
  });

  it('shouldAggregateOnlyRequesterBets_WhenOtherUsersHaveBets', async () => {
    // Arrange
    const handler = new GetPlayerStatsHandler(
      new ScopedBetRepository([
        betOf('u1', BetStatus.Won, 20, 2),
        betOf('attacker', BetStatus.Won, 1000, 2),
        betOf('attacker', BetStatus.Lost, 999, 2),
      ]),
    );

    // Act
    const stats = await handler.execute(new PlayerStatsQuery('u1'));

    // Assert
    expect(stats).toMatchObject({ totalBets: 1, won: 1, lost: 0, totalStaked: 20, netResult: 20 });
  });
});
