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
  // Clé d'idempotence du dépôt (header `Idempotency-Key`). Sert de base aux opKeys charge/crédit/
  // refund → exactly-once de bout en bout (rejeu = aucun double mouvement).
  depositId: string;
  // Étape AVAL optionnelle exécutée APRÈS le commit du crédit (ex. poser un pari). Si elle échoue,
  // la saga compense (reverse + refund). Absente → dépôt simple (charge + crédit).
  afterCredit?: () => Promise<void>;
}

export interface DepositFundsResult {
  depositId: string;
  chargeId: string;
  amount: number;
  status: 'CREDITED';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Saga ORCHESTRÉE du dépôt par paiement externe (ADR-004). Étapes : charge PSP (idempotente) →
// crédit wallet (atomique, journalisé) → étape aval optionnelle. À tout échec APRÈS la charge,
// transaction(s) compensatoire(s) IDEMPOTENTE(s) : remboursement PSP + reverse du crédit + notif.
// Invariants money : pas de double-charge, pas de double-crédit, jamais de charge sans crédit non
// compensée, jamais de perte plateforme (on reverse le crédit AVANT de rendre l'argent au PSP).
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

    // 1) Charge PSP. La résilience (circuit breaker / timeout / retry) est portée par l'adapter.
    //    Si la charge échoue (panne, circuit ouvert), rien n'a été encaissé → aucune compensation,
    //    on remonte l'erreur. Pas de charge sans crédit possible ici.
    const charge = await this.payment.charge({
      amount,
      currency: 'eur',
      idempotencyKey: depositOpKey,
      reference: `${userId}:${depositId}`,
    });

    // 2) Crédit wallet, atomique + idempotent (opKey). Si ça échoue, la transaction rollback
    //    entièrement → rien crédité → on REMBOURSE la charge (charge-sans-crédit évité).
    try {
      await this.uow.withTransaction(() => this.credit.credit(userId, amount, depositOpKey));
    } catch {
      await this.compensate(userId, amount, depositId, charge.chargeId, false, 'CREDIT_FAILED');
      throw new DomainError('Dépôt impossible : le paiement a été intégralement remboursé.', 422);
    }

    // 3) Étape aval optionnelle (après commit du crédit). En cas d'échec, on défait le crédit ET
    //    on rembourse (compensation complète).
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

  // Compensation idempotente. Ordre money-safe : on reverse d'abord le crédit (si appliqué) +
  // notif DANS une transaction, PUIS on rembourse le PSP. Ainsi la plateforme n'est jamais à la
  // fois remboursée ET créditée (pas de perte) ; un échec du refund PSP est rejouable (clé d'idem).
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
