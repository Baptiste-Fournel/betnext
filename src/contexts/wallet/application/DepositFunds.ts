import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { WalletCreditPort } from '../../../shared-kernel/ports/WalletCreditPort';
import { PaymentGateway } from './ports/PaymentGateway';
import { UnitOfWork } from './ports/UnitOfWork';
import { WalletRefundPort } from './ports/WalletRefundPort';
import {
  DepositCompensationReason,
  DepositNotificationPort,
} from './ports/DepositNotificationPort';

export interface DepositFundsInput {
  userId: string;
  amount: number;
  depositId: string;
  afterCredit?: () => Promise<void>;
}

export interface DepositFundsResult {
  depositId: string;
  chargeId: string;
  amount: number;
  status: 'CREDITED';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export class DepositFunds {
  constructor(
    private readonly payment: PaymentGateway,
    private readonly uow: UnitOfWork,
    private readonly credit: WalletCreditPort,
    private readonly refundWallet: WalletRefundPort,
    private readonly notifier: DepositNotificationPort,
  ) {}

  async execute(input: DepositFundsInput): Promise<DepositFundsResult> {
    const userId = input.userId?.trim();
    if (!userId) {
      throw new DomainError('userId requis');
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new DomainError('Le montant du dépôt doit être un nombre strictement positif');
    }
    const depositId = input.depositId?.trim();
    if (!depositId) {
      throw new DomainError("depositId (clé d'idempotence) requis");
    }
    const amount = round2(input.amount);
    const depositOpKey = `deposit:${depositId}`;

    const charge = await this.payment.charge({
      amount,
      currency: 'eur',
      idempotencyKey: depositOpKey,
      reference: `${userId}:${depositId}`,
    });

    try {
      await this.uow.withTransaction(() => this.credit.credit(userId, amount, depositOpKey));
    } catch {
      await this.compensate(userId, amount, depositId, charge.chargeId, false, 'CREDIT_FAILED');
      throw new DomainError('Dépôt impossible : le paiement a été intégralement remboursé.', 422);
    }

    if (input.afterCredit) {
      try {
        await input.afterCredit();
      } catch {
        await this.compensate(
          userId,
          amount,
          depositId,
          charge.chargeId,
          true,
          'DOWNSTREAM_FAILED',
        );
        throw new DomainError(
          'Dépôt annulé : une étape a échoué, vos fonds ont été remboursés.',
          422,
        );
      }
    }

    return { depositId, chargeId: charge.chargeId, amount, status: 'CREDITED' };
  }

  private async compensate(
    userId: string,
    amount: number,
    depositId: string,
    chargeId: string,
    reverseWallet: boolean,
    reason: DepositCompensationReason,
  ): Promise<void> {
    const refundOpKey = `refund:${depositId}`;
    await this.uow.withTransaction(async () => {
      if (reverseWallet) {
        await this.refundWallet.refund(userId, amount, refundOpKey);
      }
      await this.notifier.notifyDepositCompensated({ userId, depositId, amount, reason });
    });
    await this.payment.refund({ chargeId, amount, idempotencyKey: refundOpKey });
  }
}
