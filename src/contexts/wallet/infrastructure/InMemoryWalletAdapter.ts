import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletDebitPort } from '../../../shared-kernel/ports/WalletDebitPort';
import { WalletCreditPort } from '../../../shared-kernel/ports/WalletCreditPort';
import { WalletFunding } from '../application/ports/WalletFunding';
import { WalletLedgerView, WalletLedgerRow } from '../application/ports/WalletLedgerView';
import { WalletRefundPort } from '../application/ports/WalletRefundPort';
import { WalletBalanceView } from '../application/ports/WalletBalanceView';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export class InMemoryWalletAdapter
  implements
    WalletDebitPort,
    WalletCreditPort,
    WalletFunding,
    WalletLedgerView,
    WalletRefundPort,
    WalletBalanceView
{
  private readonly balances = new Map<string, number>();
  private readonly appliedOps = new Set<string>();
  private readonly movements: Array<{ userId: string; amount: number }> = [];

  constructor(private readonly defaultBalance = 100) {}

  async open(userId: string, openingBalance: number): Promise<boolean> {
    if (this.balances.has(userId)) {
      return false;
    }
    this.balances.set(userId, round2(openingBalance));
    this.record(`opening:${userId}`, userId, openingBalance);
    return true;
  }

  async debit(userId: string, amount: number, operationRef: string): Promise<void> {
    this.ensure(userId);
    const opKey = `stake:${operationRef}`;
    if (this.appliedOps.has(opKey)) {
      return;
    }
    if (amount > this.currentBalance(userId)) {
      throw new DomainError('Insufficient balance');
    }
    this.balances.set(userId, round2(this.currentBalance(userId) - amount));
    this.record(opKey, userId, -amount);
  }

  async credit(userId: string, amount: number, opKey: string): Promise<void> {
    if (this.appliedOps.has(opKey)) {
      return;
    }
    if (!this.balances.has(userId)) {
      throw new DomainError('Wallet introuvable pour le crédit');
    }
    this.balances.set(userId, round2(this.currentBalance(userId) + amount));
    this.record(opKey, userId, amount);
  }

  // Reverse de crédit (compensation de saga), idempotent par opKey, ligne ledger signée négative.
  async refund(userId: string, amount: number, opKey: string): Promise<void> {
    if (this.appliedOps.has(opKey)) {
      return;
    }
    if (!this.balances.has(userId)) {
      throw new DomainError('Wallet introuvable pour le remboursement');
    }
    this.balances.set(userId, round2(this.currentBalance(userId) - amount));
    this.record(opKey, userId, -amount);
  }

  async balanceOf(userId: string): Promise<number | null> {
    return this.balances.has(userId) ? round2(this.balances.get(userId)!) : null;
  }

  async loadLedgerVsBalance(): Promise<WalletLedgerRow[]> {
    const sums = new Map<string, number>();
    for (const m of this.movements) {
      sums.set(m.userId, round2((sums.get(m.userId) ?? 0) + m.amount));
    }
    return [...this.balances.entries()].map(([userId, balance]) => ({
      userId,
      balance,
      ledgerSum: round2(sums.get(userId) ?? 0),
    }));
  }

  private ensure(userId: string): void {
    if (!this.balances.has(userId)) {
      this.balances.set(userId, round2(this.defaultBalance));
      if (this.defaultBalance !== 0) {
        this.record(`opening:${userId}`, userId, this.defaultBalance);
      }
    }
  }

  private record(opKey: string, userId: string, amount: number): void {
    if (this.appliedOps.has(opKey)) {
      return;
    }
    this.appliedOps.add(opKey);
    this.movements.push({ userId, amount: round2(amount) });
  }

  private currentBalance(userId: string): number {
    return this.balances.get(userId) ?? this.defaultBalance;
  }
}
