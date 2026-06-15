import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletDebitPort } from '../../../shared-kernel/ports/WalletDebitPort';

/**
 * Adapter en mémoire (mode sans DATABASE_URL). Solde par utilisateur, débit simple.
 * Le solde initial par défaut (POC, NON tranché) est facilement configurable.
 */
export class InMemoryWalletDebitAdapter implements WalletDebitPort {
  private readonly balances = new Map<string, number>();

  constructor(private readonly defaultBalance = 100) {}

  async debit(userId: string, amount: number, _idempotencyKey: string): Promise<void> {
    const current = this.balances.get(userId) ?? this.defaultBalance;
    if (amount > current) {
      throw new DomainError('Insufficient balance');
    }
    this.balances.set(userId, Math.round((current - amount) * 100) / 100);
  }
}
