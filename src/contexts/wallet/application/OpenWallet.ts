import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletFunding } from './ports/WalletFunding';

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
