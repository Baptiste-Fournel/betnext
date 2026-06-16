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
  async findPendingByOutcomes(): Promise<Bet[]> {
    return [];
  }

  async history(): Promise<StoredBetEvent[]> {
    return [];
  }
}

describe('GetBetHandler (read-your-writes, cote figée)', () => {
  it('renvoie la vue du pari avec sa cote FIGÉE (snapshot), jamais recalculée', async () => {
    const bet = Bet.restore({
      id: 'bet-1',
      userId: 'u1',
      outcomeId: 'o1',
      stake: 20,
      lockedOdds: Odds.of(2),
      potentialGain: 40,
      status: BetStatus.Pending,
      createdAt: new Date(),
    });
    const view = await new GetBetHandler(new StubBetRepository(bet)).execute(
      new GetBetQuery('bet-1'),
    );
    expect(view).toMatchObject({ betId: 'bet-1', lockedOdds: 2, potentialGain: 40, stake: 20 });
  });

  it('pari inconnu → null', async () => {
    const view = await new GetBetHandler(new StubBetRepository(null)).execute(new GetBetQuery('x'));
    expect(view).toBeNull();
  });
});
