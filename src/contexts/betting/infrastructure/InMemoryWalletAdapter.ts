import { WalletPort } from '../application/ports/WalletPort';

/**
 * Stub de démarrage du port wallet, idempotent. En production, l'intégration au contexte Wallet
 * se fait dans la MÊME transaction Postgres (ADR-003) ou via événements + ACL, jamais par import
 * direct du domaine Wallet (frontière inter-contexte — ADR-001).
 */
export class InMemoryWalletAdapter implements WalletPort {
  private readonly applied = new Set<string>();

  async debit(_userId: string, _amount: number, idempotencyKey: string): Promise<void> {
    if (this.applied.has(idempotencyKey)) return;
    this.applied.add(idempotencyKey);
  }
}
