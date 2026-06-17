import { WalletLedgerView } from './ports/WalletLedgerView';

export interface WalletDrift {
  userId: string;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
}

export interface ReconciliationReport {
  checkedAt: string;
  walletsChecked: number;
  balanced: boolean;
  drifts: WalletDrift[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export class ReconcileWallets {
  private static readonly EPSILON = 0.005;

  constructor(private readonly view: WalletLedgerView) {}

  async execute(): Promise<ReconciliationReport> {
    const rows = await this.view.loadLedgerVsBalance();
    const drifts: WalletDrift[] = [];
    for (const row of rows) {
      const difference = round2(row.balance - row.ledgerSum);
      if (Math.abs(difference) >= ReconcileWallets.EPSILON) {
        drifts.push({
          userId: row.userId,
          expectedBalance: round2(row.ledgerSum),
          actualBalance: round2(row.balance),
          difference,
        });
      }
    }
    return {
      checkedAt: new Date().toISOString(),
      walletsChecked: rows.length,
      balanced: drifts.length === 0,
      drifts,
    };
  }
}
