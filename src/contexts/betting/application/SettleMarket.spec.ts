import { SettleMarket } from './SettleMarket';
import { SettlementStrategyFactory } from './SettlementStrategyFactory';
import { Bet } from '../domain/Bet';
import { BetStatus } from '../domain/BetStatus';
import { Odds } from '../../../shared-kernel/domain/Odds';
import { BetRepository, StoredBetEvent } from './ports/BetRepository';
import { WalletCreditPort } from '../../../shared-kernel/ports/WalletCreditPort';
import { UnitOfWork } from './ports/UnitOfWork';

class StubBets implements BetRepository {
  readonly store = new Map<string, Bet>();
  add(bet: Bet): void {
    this.store.set(bet.id, bet);
  }
  async save(bet: Bet): Promise<void> {
    bet.pullEvents();
    this.store.set(bet.id, bet);
  }
  async findById(id: string): Promise<Bet | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<Bet[]> {
    return [];
  }

  async listByUser(): Promise<Bet[]> {
    return [];
  }

  async findPendingByOutcomes(outcomeIds: string[]): Promise<Bet[]> {
    const wanted = new Set(outcomeIds);
    return [...this.store.values()].filter(
      (b) => b.status === BetStatus.Pending && wanted.has(b.outcomeId),
    );
  }
  async history(): Promise<StoredBetEvent[]> {
    return [];
  }
}
class RecordingCredit implements WalletCreditPort {
  readonly credits: Array<{ userId: string; amount: number; opKey: string }> = [];
  private readonly applied = new Set<string>();
  constructor(private readonly boomUser?: string) {}
  async credit(userId: string, amount: number, opKey: string): Promise<void> {
    if (userId === this.boomUser) throw new Error('crédit en échec (pari empoisonné)');
    if (this.applied.has(opKey)) return;
    this.applied.add(opKey);
    this.credits.push({ userId, amount, opKey });
  }
}
const noopUow: UnitOfWork = { withTransaction: <T>(w: () => Promise<T>): Promise<T> => w() };
const placed = (id: string, userId: string, outcomeId: string): Bet =>
  Bet.place({ id, userId, outcomeId, stake: 10, currentOdds: Odds.of(2) });

describe('SettleMarket (W/L/V settlement via the Strategy seam)', () => {
  it('shouldCreditWinnerAtLockedOddsAndNotCreditLoser_WhenMarketSettled', async () => {
    // Given
    const bets = new StubBets();
    bets.add(placed('b1', 'winner', 'A'));
    bets.add(placed('b2', 'loser', 'B'));
    const credit = new RecordingCredit();

    // When
    const out = await new SettleMarket(
      bets,
      credit,
      new SettlementStrategyFactory(),
      noopUow,
    ).execute({ outcomes: ['A', 'B'], winningOutcomeId: 'A', voided: false });

    // Then
    expect(out).toMatchObject({ settled: 2, won: 1, lost: 1, voided: 0, failed: 0 });
    expect((await bets.findById('b1'))?.status).toBe(BetStatus.Won);
    expect((await bets.findById('b2'))?.status).toBe(BetStatus.Lost);
    expect(credit.credits).toEqual([{ userId: 'winner', amount: 20, opKey: 'payout:b1' }]);
  });

  it('shouldRefundExactStake_WhenMarketVoided', async () => {
    // Given
    const bets = new StubBets();
    bets.add(placed('b1', 'u1', 'A'));
    const credit = new RecordingCredit();

    // When
    const out = await new SettleMarket(
      bets,
      credit,
      new SettlementStrategyFactory(),
      noopUow,
    ).execute({ outcomes: ['A'], winningOutcomeId: null, voided: true });

    // Then
    expect(out).toMatchObject({ settled: 1, voided: 1 });
    expect(credit.credits).toEqual([{ userId: 'u1', amount: 10, opKey: 'refund:b1' }]);
  });

  it('shouldNotCreditAgain_WhenSettlementReplayed', async () => {
    // Given
    const bets = new StubBets();
    bets.add(placed('b1', 'winner', 'A'));
    const credit = new RecordingCredit();
    const settle = new SettleMarket(bets, credit, new SettlementStrategyFactory(), noopUow);

    // When
    await settle.execute({ outcomes: ['A'], winningOutcomeId: 'A', voided: false });
    const second = await settle.execute({ outcomes: ['A'], winningOutcomeId: 'A', voided: false });

    // Then
    expect(second).toMatchObject({ settled: 0, won: 0 });
    expect(credit.credits).toHaveLength(1);
  });

  it('shouldSettleOtherBets_WhenOneBetCreditFails', async () => {
    // Given
    const bets = new StubBets();
    bets.add(placed('b1', 'ok', 'A'));
    bets.add(placed('b2', 'boom', 'A'));
    const credit = new RecordingCredit('boom');

    // When
    const out = await new SettleMarket(
      bets,
      credit,
      new SettlementStrategyFactory(),
      noopUow,
    ).execute({ outcomes: ['A'], winningOutcomeId: 'A', voided: false });

    // Then
    expect(out.settled).toBe(1);
    expect(out.failed).toBe(1);
    expect(credit.credits).toEqual([{ userId: 'ok', amount: 20, opKey: 'payout:b1' }]);
  });
});
