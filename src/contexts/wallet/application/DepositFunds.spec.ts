import { DepositFunds } from './DepositFunds';
import { UnitOfWork } from './ports/UnitOfWork';
import { WalletCreditPort } from '../../../shared-kernel/ports/WalletCreditPort';
import { WalletRefundPort } from './ports/WalletRefundPort';
import { DepositCompensatedEvent, DepositNotificationPort } from './ports/DepositNotificationPort';
import {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from './ports/PaymentGateway';

const directUow: UnitOfWork = {
  withTransaction: <T>(work: () => Promise<T>): Promise<T> => work(),
};

class FakePayment implements PaymentGateway {
  private readonly charges = new Map<string, ChargeResult>();
  private readonly refunds = new Map<string, RefundResult>();
  constructor(private readonly failChargeFlag = false) {}
  get chargeCount(): number {
    return this.charges.size;
  }
  get refundCount(): number {
    return this.refunds.size;
  }
  charge(request: ChargeRequest): Promise<ChargeResult> {
    const existing = this.charges.get(request.idempotencyKey);
    if (existing) return Promise.resolve(existing);
    if (this.failChargeFlag) return Promise.reject(new Error('charge KO'));
    const result: ChargeResult = { chargeId: `ch_${request.idempotencyKey}`, status: 'SUCCEEDED' };
    this.charges.set(request.idempotencyKey, result);
    return Promise.resolve(result);
  }
  refund(request: RefundRequest): Promise<RefundResult> {
    const existing = this.refunds.get(request.idempotencyKey);
    if (existing) return Promise.resolve(existing);
    const result: RefundResult = { refundId: `re_${request.idempotencyKey}`, status: 'REFUNDED' };
    this.refunds.set(request.idempotencyKey, result);
    return Promise.resolve(result);
  }
}

class FakeWallet implements WalletCreditPort, WalletRefundPort {
  balance: number;
  readonly ops = new Map<string, number>();
  failCredit = false;

  constructor(start = 0) {
    this.balance = start;
  }

  credit(_userId: string, amount: number, opKey: string): Promise<void> {
    if (this.failCredit) {
      return Promise.reject(new Error('crédit wallet impossible (DB down simulée)'));
    }
    if (!this.ops.has(opKey)) {
      this.ops.set(opKey, amount);
      this.balance += amount;
    }
    return Promise.resolve();
  }

  refund(_userId: string, amount: number, opKey: string): Promise<void> {
    if (!this.ops.has(opKey)) {
      this.ops.set(opKey, -amount);
      this.balance -= amount;
    }
    return Promise.resolve();
  }
}

class CapturingNotifier implements DepositNotificationPort {
  readonly events: DepositCompensatedEvent[] = [];
  notifyDepositCompensated(event: DepositCompensatedEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

const make = (
  wallet: FakeWallet,
  payment: PaymentGateway,
  notifier: DepositNotificationPort,
): DepositFunds => new DepositFunds(payment, directUow, wallet, wallet, notifier);

describe('DepositFunds (BET-17) — saga Stripe : charge → crédit → compensation, money-safe', () => {
  it('shouldChargeOnceAndCreditWallet_WhenHappyPath', async () => {
    // Arrange
    const wallet = new FakeWallet(100);
    const payment = new FakePayment();
    const notifier = new CapturingNotifier();
    const saga = make(wallet, payment, notifier);

    // Act
    const result = await saga.execute({ userId: 'p1', amount: 50, depositId: 'd1' });

    // Assert
    expect(result).toMatchObject({ depositId: 'd1', amount: 50, status: 'CREDITED' });
    expect(wallet.balance).toBe(150);
    expect(payment.chargeCount).toBe(1);
    expect(payment.refundCount).toBe(0);
    expect(notifier.events).toEqual([]);
  });

  it('shouldRefundAndLeaveBalanceUntouched_WhenWalletCreditFailsAfterCharge', async () => {
    // Arrange
    const wallet = new FakeWallet(100);
    wallet.failCredit = true;
    const payment = new FakePayment();
    const notifier = new CapturingNotifier();
    const saga = make(wallet, payment, notifier);

    // Act / Assert
    await expect(saga.execute({ userId: 'p1', amount: 50, depositId: 'd1' })).rejects.toThrow();
    expect(wallet.balance).toBe(100);
    expect(payment.chargeCount).toBe(1);
    expect(payment.refundCount).toBe(1);
    expect(notifier.events).toEqual([
      { userId: 'p1', depositId: 'd1', amount: 50, reason: 'CREDIT_FAILED' },
    ]);
  });

  it('shouldNotDoubleChargeNorDoubleCredit_WhenSameDepositReplayed', async () => {
    // Arrange
    const wallet = new FakeWallet(100);
    const payment = new FakePayment();
    const saga = make(wallet, payment, new CapturingNotifier());

    // Act
    await saga.execute({ userId: 'p1', amount: 50, depositId: 'd1' });
    await saga.execute({ userId: 'p1', amount: 50, depositId: 'd1' });

    // Assert
    expect(wallet.balance).toBe(150);
    expect(payment.chargeCount).toBe(1);
  });

  it('shouldReverseCreditAndRefund_WhenDownstreamFailsAfterCredit', async () => {
    // Arrange
    const wallet = new FakeWallet(100);
    const payment = new FakePayment();
    const notifier = new CapturingNotifier();
    const saga = make(wallet, payment, notifier);

    // Act / Assert
    await expect(
      saga.execute({
        userId: 'p1',
        amount: 50,
        depositId: 'd1',
        afterCredit: () => Promise.reject(new Error('étape aval KO')),
      }),
    ).rejects.toThrow();
    expect(wallet.balance).toBe(100);
    expect(payment.refundCount).toBe(1);
    expect(notifier.events[0]).toMatchObject({ reason: 'DOWNSTREAM_FAILED', amount: 50 });
  });

  it('shouldNotDoubleRefundNorDoubleReverse_WhenCompensationReplayed', async () => {
    // Arrange
    const wallet = new FakeWallet(100);
    const payment = new FakePayment();
    const saga = make(wallet, payment, new CapturingNotifier());
    const failingDownstream = {
      userId: 'p1',
      amount: 50,
      depositId: 'd1',
      afterCredit: (): Promise<void> => Promise.reject(new Error('aval KO')),
    };

    // Act
    await expect(saga.execute(failingDownstream)).rejects.toThrow();
    await expect(saga.execute(failingDownstream)).rejects.toThrow();

    // Assert
    expect(wallet.balance).toBe(100);
    expect(payment.refundCount).toBe(1);
  });

  it('shouldNotCreditNorCompensate_WhenChargeFailsUpfront', async () => {
    // Arrange
    const wallet = new FakeWallet(100);
    const payment = new FakePayment(true);
    const notifier = new CapturingNotifier();
    const saga = make(wallet, payment, notifier);

    // Act / Assert
    await expect(saga.execute({ userId: 'p1', amount: 50, depositId: 'd1' })).rejects.toThrow();
    expect(wallet.balance).toBe(100);
    expect(payment.chargeCount).toBe(0);
    expect(payment.refundCount).toBe(0);
    expect(notifier.events).toEqual([]);
  });

  it('shouldRejectDeposit_WhenAmountNotPositive', async () => {
    // Arrange
    const wallet = new FakeWallet(100);
    const payment = new FakePayment();
    const saga = make(wallet, payment, new CapturingNotifier());

    // Act / Assert
    await expect(saga.execute({ userId: 'p1', amount: 0, depositId: 'd1' })).rejects.toThrow();
    expect(payment.chargeCount).toBe(0);
  });
});
