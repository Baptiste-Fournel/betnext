import { ReconcileWallets } from './ReconcileWallets';
import { WalletLedgerView, WalletLedgerRow } from './ports/WalletLedgerView';

const view = (rows: WalletLedgerRow[]): WalletLedgerView => ({
  loadLedgerVsBalance: async (): Promise<WalletLedgerRow[]> => rows,
});

describe('ReconcileWallets (BET-15) — détection de dérive, sans auto-correction', () => {
  it('rapporte balanced quand chaque solde == Σ(ledger)', async () => {
    const report = await new ReconcileWallets(
      view([
        { userId: 'u1', balance: 80, ledgerSum: 80 },
        { userId: 'u2', balance: 0, ledgerSum: 0 },
      ]),
    ).execute();
    expect(report.balanced).toBe(true);
    expect(report.walletsChecked).toBe(2);
    expect(report.drifts).toEqual([]);
  });

  it('détecte une dérive (solde en trop), la rapporte et NE corrige PAS la source', async () => {
    const rows: WalletLedgerRow[] = [{ userId: 'u1', balance: 130, ledgerSum: 80 }];
    const recon = new ReconcileWallets(view(rows));
    const report = await recon.execute();
    expect(report.balanced).toBe(false);
    expect(report.drifts).toHaveLength(1);
    expect(report.drifts[0]).toMatchObject({
      userId: 'u1',
      expectedBalance: 80,
      actualBalance: 130,
      difference: 50,
    });
    // rejeu : rapport IDENTIQUE (lecture seule → idempotent) et source inchangée (zéro auto-correction)
    const report2 = await recon.execute();
    expect(report2.drifts).toEqual(report.drifts);
    expect(rows[0].balance).toBe(130);
  });

  it('signale une dérive négative (solde manquant)', async () => {
    const report = await new ReconcileWallets(
      view([{ userId: 'u1', balance: 60, ledgerSum: 80 }]),
    ).execute();
    expect(report.drifts[0].difference).toBe(-20);
  });

  it('ignore le bruit flottant sous le centime (tolérance)', async () => {
    const report = await new ReconcileWallets(
      view([{ userId: 'u1', balance: 80, ledgerSum: 80.001 }]),
    ).execute();
    expect(report.balanced).toBe(true);
  });
});
