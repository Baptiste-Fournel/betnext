import { PlaceBet } from './PlaceBet';
import { Bet } from '../domain/Bet';
import { Odds } from '../../../shared-kernel/domain/Odds';
import { BetRepository } from './ports/BetRepository';
import { OddsProvider } from './ports/OddsProvider';
import { WalletPort } from './ports/WalletPort';
import { IdGenerator } from './ports/IdGenerator';

class InMemoryBets implements BetRepository {
  readonly saved: Bet[] = [];
  async save(bet: Bet): Promise<void> {
    this.saved.push(bet);
  }
  async findById(id: string): Promise<Bet | null> {
    return this.saved.find((b) => b.id === id) ?? null;
  }
}

class FixedOdds implements OddsProvider {
  constructor(private readonly v: number) {}
  async currentOdds(): Promise<Odds> {
    return Odds.of(this.v);
  }
}

class SpyWallet implements WalletPort {
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

describe('PlaceBet (use case hexagonal)', () => {
  it('fige la cote de marché courante sur le pari et débite le wallet une fois', async () => {
    const bets = new InMemoryBets();
    const wallet = new SpyWallet();
    const useCase = new PlaceBet(bets, new FixedOdds(2.5), wallet, new SeqIds());

    const out = await useCase.execute({ userId: 'u1', outcomeId: 'o1', stake: 20 });

    expect(out.lockedOdds).toBe(2.5);
    expect(out.potentialGain).toBe(50);
    expect(bets.saved).toHaveLength(1);
    expect(wallet.debits).toEqual([{ userId: 'u1', amount: 20, key: out.betId }]);
  });
});
