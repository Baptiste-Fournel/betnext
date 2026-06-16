import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletFunding } from './ports/WalletFunding';

/**
 * Ouvre/alimente un wallet avec un solde d'ouverture (origine du ledger — BET-15). Écriture NORMALE
 * (validation simple, pas la rigueur money-safety du chemin de pari) : le solde et l'entrée
 * d'ouverture sont écrits atomiquement par l'adapter, et l'opération est idempotente.
 */
export class OpenWallet {
  constructor(private readonly funding: WalletFunding) {}

  async execute(
    userId: string,
    openingBalance: number,
  ): Promise<{ userId: string; opened: boolean }> {
    const id = userId?.trim();
    if (!id) {
      throw new DomainError('userId requis');
    }
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      throw new DomainError('openingBalance doit être un nombre >= 0');
    }
    const opened = await this.funding.open(id, openingBalance);
    return { userId: id, opened };
  }
}
