import { InMemoryWalletAdapter } from './InMemoryWalletAdapter';
import { ReconcileWallets } from '../application/ReconcileWallets';

describe('InMemoryWalletAdapter — full ledger (BET-15), Postgres mirror', () => {
  it('shouldKeepLedgerSumEqualToBalance_WhenOpenDebitCredit', async () => {
    // Arrange
    const w = new InMemoryWalletAdapter(0);

    // Act
    await w.open('u1', 100);
    await w.debit('u1', 20, 'bet-1');
    await w.credit('u1', 40, 'payout:bet-1');

    // Assert
    const u1 = (await w.loadLedgerVsBalance()).find((r) => r.userId === 'u1')!;
    expect(u1.balance).toBe(120);
    expect(u1.ledgerSum).toBe(120);
    expect((await new ReconcileWallets(w).execute()).balanced).toBe(true);
  });

  it('shouldNotReDebit_WhenSameReferenceReplayed', async () => {
    // Arrange
    const w = new InMemoryWalletAdapter(0);
    await w.open('u1', 100);

    // Act
    await w.debit('u1', 30, 'bet-1');
    await w.debit('u1', 30, 'bet-1');

    // Assert
    const u1 = (await w.loadLedgerVsBalance())[0];
    expect(u1.balance).toBe(70);
    expect(u1.ledgerSum).toBe(70);
  });

  it('shouldStayBalanced_WhenDemoWalletTouchedWithoutExplicitOpen', async () => {
    // Arrange
    const w = new InMemoryWalletAdapter(100);

    // Act
    await w.debit('demo', 20, 'bet-9');

    // Assert
    expect((await new ReconcileWallets(w).execute()).balanced).toBe(true);
    const u = (await w.loadLedgerVsBalance())[0];
    expect(u.balance).toBe(80);
    expect(u.ledgerSum).toBe(80);
  });

  it('shouldNoOpAndStayBalanced_WhenWalletReopened', async () => {
    // Arrange
    const w = new InMemoryWalletAdapter(0);

    // Act / Assert
    expect(await w.open('u1', 100)).toBe(true);
    expect(await w.open('u1', 999)).toBe(false);
    expect((await new ReconcileWallets(w).execute()).balanced).toBe(true);
    expect((await w.loadLedgerVsBalance())[0].balance).toBe(100);
  });

  it('shouldThrowAndCreateNothing_WhenCreditingUnopenedWallet', async () => {
    // Arrange
    const w = new InMemoryWalletAdapter(0);

    // Act / Assert
    await expect(w.credit('ghost', 40, 'payout:x')).rejects.toThrow();
    expect(await w.loadLedgerVsBalance()).toEqual([]);
  });
});
