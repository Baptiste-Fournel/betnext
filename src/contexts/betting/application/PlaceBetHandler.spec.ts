import { PlaceBetHandler } from './PlaceBetHandler';
import { PlaceBetCommand } from './PlaceBetCommand';
import { PlaceBet } from './PlaceBet';
import { Bet } from '../domain/Bet';
import { Odds } from '../../../shared-kernel/domain/Odds';
import { BetRepository, StoredBetEvent } from './ports/BetRepository';
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

  async history(): Promise<StoredBetEvent[]> {
    return [];
  }
}
class FixedOdds implements OddsProvider {
  async currentOdds(): Promise<Odds> {
    return Odds.of(2.5);
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

describe('PlaceBetHandler (CQRS → use case)', () => {
  it('exécute la commande, fige la cote et débite le wallet une seule fois', async () => {
    const bets = new InMemoryBets();
    const wallet = new SpyWallet();
    const handler = new PlaceBetHandler(new PlaceBet(bets, new FixedOdds(), wallet, new SeqIds()));

    const out = await handler.execute(new PlaceBetCommand('u1', 'o1', 20));

    expect(out.lockedOdds).toBe(2.5);
    expect(out.potentialGain).toBe(50);
    expect(bets.saved).toHaveLength(1);
    expect(wallet.debits).toEqual([{ userId: 'u1', amount: 20, key: out.betId }]);
  });
});
