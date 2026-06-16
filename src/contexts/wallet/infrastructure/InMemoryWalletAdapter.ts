import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletDebitPort } from '../../../shared-kernel/ports/WalletDebitPort';
import { WalletCreditPort } from '../../../shared-kernel/ports/WalletCreditPort';

/**
 * Adapter en mémoire DÉBIT + CRÉDIT partageant le MÊME solde (mode sans DATABASE_URL / tests).
 * Crédit exactement-une-fois via un Set d'`opKey` (mime la PK `wallet_operations` du vrai adapter).
 */
export class InMemoryWalletAdapter implements WalletDebitPort, WalletCreditPort {
  private readonly balances = new Map<string, number>();
  private readonly appliedCredits = new Set<string>();

  constructor(private readonly defaultBalance = 100) {}

  async debit(userId: string, amount: number, _idempotencyKey: string): Promise<void> {
    const current = this.balanceOf(userId);
    if (amount > current) {
      throw new DomainError('Insufficient balance');
    }
    this.balances.set(userId, Math.round((current - amount) * 100) / 100);
  }

  async credit(userId: string, amount: number, opKey: string): Promise<void> {
    if (this.appliedCredits.has(opKey)) {
      return; // déjà appliqué → no-op (exactement-une-fois)
    }
    this.appliedCredits.add(opKey);
    this.balances.set(userId, Math.round((this.balanceOf(userId) + amount) * 100) / 100);
  }

  private balanceOf(userId: string): number {
    return this.balances.get(userId) ?? this.defaultBalance;
  }
}
