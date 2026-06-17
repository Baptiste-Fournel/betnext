import { ReconcileWallets } from './ReconcileWallets';
import { WalletLedgerView, WalletLedgerRow } from './ports/WalletLedgerView';

const view = (rows: WalletLedgerRow[]): WalletLedgerView => ({
  loadLedgerVsBalance: async (): Promise<WalletLedgerRow[]> => rows,
});

describe('ReconcileWallets (BET-15) — détection de dérive, sans auto-correction', () => {
  it('shouldReportBalanced_WhenEveryBalanceMatchesLedgerSum', async () => {
    // Arrange
    const ledger = view([
      { userId: 'u1', balance: 80, ledgerSum: 80 },
      { userId: 'u2', balance: 0, ledgerSum: 0 },
    ]);

    // Act
    const report = await new ReconcileWallets(ledger).execute();

    // Assert
    expect(report.balanced).toBe(true);
    expect(report.walletsChecked).toBe(2);
    expect(report.drifts).toEqual([]);
  });

  it('shouldReportDriftAndLeaveSourceUntouched_WhenBalanceExceedsLedgerSum', async () => {
    // Arrange
    const rows: WalletLedgerRow[] = [{ userId: 'u1', balance: 130, ledgerSum: 80 }];
    const recon = new ReconcileWallets(view(rows));

    // Act
    const report = await recon.execute();
    const report2 = await recon.execute();

    // Assert
    expect(report.balanced).toBe(false);
    expect(report.drifts).toHaveLength(1);
    expect(report.drifts[0]).toMatchObject({
      userId: 'u1',
      expectedBalance: 80,
      actualBalance: 130,
      difference: 50,
    });
    expect(report2.drifts).toEqual(report.drifts);
    expect(rows[0].balance).toBe(130);
  });

  it('shouldReportNegativeDifference_WhenBalanceBelowLedgerSum', async () => {
    // Arrange
    const ledger = view([{ userId: 'u1', balance: 60, ledgerSum: 80 }]);

    // Act
    const report = await new ReconcileWallets(ledger).execute();

    // Assert
    expect(report.drifts[0].difference).toBe(-20);
  });

  it('shouldReportBalanced_WhenDifferenceBelowOneCentTolerance', async () => {
    // Arrange
    const ledger = view([{ userId: 'u1', balance: 80, ledgerSum: 80.001 }]);

    // Act
    const report = await new ReconcileWallets(ledger).execute();

    // Assert
    expect(report.balanced).toBe(true);
  });
});
