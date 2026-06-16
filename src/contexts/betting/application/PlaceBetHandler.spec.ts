import { PlaceBetHandler } from './PlaceBetHandler';
import { PlaceBetCommand } from './PlaceBetCommand';
import { PlaceBet } from './PlaceBet';
import { IdempotentPlaceBet } from './IdempotentPlaceBet';
import { Bet } from '../domain/Bet';
import { Odds } from '../../../shared-kernel/domain/Odds';
import { WalletDebitPort } from '../../../shared-kernel/ports/WalletDebitPort';
import { BetRepository, StoredBetEvent } from './ports/BetRepository';
import { CurrentOdds, OddsProvider } from './ports/OddsProvider';
import { IdGenerator } from './ports/IdGenerator';
import { UnitOfWork } from './ports/UnitOfWork';
import { ClaimOutcome, IdempotencyStore } from './ports/IdempotencyStore';

class InMemoryBets implements BetRepository {
  readonly saved: Bet[] = [];
  async save(bet: Bet): Promise<void> {
    this.saved.push(bet);
  }
  async findById(id: string): Promise<Bet | null> {
    return this.saved.find((b) => b.id === id) ?? null;
  }
  async findPendingByOutcomes(): Promise<Bet[]> {
    return [];
  }

  async history(): Promise<StoredBetEvent[]> {
    return [];
  }
}
class FixedOdds implements OddsProvider {
  constructor(private readonly v: number) {}
  async currentOdds(): Promise<CurrentOdds> {
    return { value: Odds.of(this.v), provisional: false };
  }
}
class SpyWallet implements WalletDebitPort {
  readonly debits: Array<{ userId: string; amount: number; key: string }> = [];
  async debit(userId: string, amount: number, key: string): Promise<void> {
    this.debits.push({ userId, amount, key });
  }
}
class SeqIds implements IdGenerator {
  private n = 0;
  next(): string {
    return `bet-${++this.n}`;
  }
}

const noopUow: UnitOfWork = {
  withTransaction: <T>(work: () => Promise<T>): Promise<T> => work(),
};
const alwaysClaims: IdempotencyStore = {
  async claim(): Promise<ClaimOutcome> {
    return { claimed: true };
  },
  async complete(): Promise<void> {},
  async release(): Promise<void> {},
};

describe('PlaceBetHandler (CQRS → use case idempotent)', () => {
  it('exécute la commande, fige la cote et débite le wallet une seule fois', async () => {
    const bets = new InMemoryBets();
    const wallet = new SpyWallet();
    const placeBet = new PlaceBet(bets, new FixedOdds(2.5), wallet, new SeqIds(), noopUow);
    const handler = new PlaceBetHandler(new IdempotentPlaceBet(placeBet, alwaysClaims, noopUow));

    const out = await handler.execute(new PlaceBetCommand('u1', 'o1', 20, 'key-1', 'hash-1'));

    expect(out.lockedOdds).toBe(2.5);
    expect(out.potentialGain).toBe(50);
    expect(bets.saved).toHaveLength(1);
    expect(wallet.debits).toEqual([{ userId: 'u1', amount: 20, key: out.betId }]);
  });
});
