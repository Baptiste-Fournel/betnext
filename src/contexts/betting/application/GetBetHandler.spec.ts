import { GetBetHandler } from './GetBetHandler';
import { GetBetQuery } from './GetBetQuery';
import { BetRepository, StoredBetEvent } from './ports/BetRepository';
import { Bet } from '../domain/Bet';
import { BetStatus } from '../domain/BetStatus';
import { Odds } from '../../../shared-kernel/domain/Odds';

class StubBetRepository implements BetRepository {
  constructor(private readonly stored: Bet | null) {}
  async save(): Promise<void> {}
  async findById(): Promise<Bet | null> {
    return this.stored;
  }
  async list(): Promise<Bet[]> {
    return [];
  }
  async listByUser(): Promise<Bet[]> {
    return [];
  }
  async findPendingByOutcomes(): Promise<Bet[]> {
    return [];
  }
  async history(): Promise<StoredBetEvent[]> {
    return [];
  }
}

const betOf = (userId: string): Bet =>
  Bet.restore({
    id: 'bet-1',
    userId,
    outcomeId: 'o1',
    stake: 20,
    lockedOdds: Odds.of(2),
    potentialGain: 40,
    status: BetStatus.Pending,
    createdAt: new Date(),
  });

describe('GetBetHandler (read-your-writes, cote figée, scoping anti-IDOR)', () => {
  it('shouldReturnViewWithLockedOdds_WhenOwnerQueriesOwnBet', async () => {
    // Arrange
    const handler = new GetBetHandler(new StubBetRepository(betOf('u1')));

    // Act
    const view = await handler.execute(new GetBetQuery('bet-1', 'u1'));

    // Assert
    expect(view).toMatchObject({ betId: 'bet-1', lockedOdds: 2, potentialGain: 40, stake: 20 });
  });

  it('shouldReturnNull_WhenAnotherUserQueriesBet', async () => {
    // Arrange
    const handler = new GetBetHandler(new StubBetRepository(betOf('u1')));

    // Act
    const view = await handler.execute(new GetBetQuery('bet-1', 'attacker'));

    // Assert
    expect(view).toBeNull();
  });

  it('shouldReturnNull_WhenBetUnknown', async () => {
    // Arrange
    const handler = new GetBetHandler(new StubBetRepository(null));

    // Act
    const view = await handler.execute(new GetBetQuery('x', 'u1'));

    // Assert
    expect(view).toBeNull();
  });
});
