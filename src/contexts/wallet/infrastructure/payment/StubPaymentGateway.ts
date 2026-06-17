import {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from '../../application/ports/PaymentGateway';

export interface StubPaymentGatewayOptions {
  failCharge?: boolean;
}

export class StubPaymentGateway implements PaymentGateway {
  private readonly charges = new Map<string, ChargeResult>();
  private readonly refunds = new Map<string, RefundResult>();

  constructor(private readonly options: StubPaymentGatewayOptions = {}) {}

  get chargeCount(): number {
    return this.charges.size;
  }

  get refundCount(): number {
    return this.refunds.size;
  }

  charge(request: ChargeRequest): Promise<ChargeResult> {
    const existing = this.charges.get(request.idempotencyKey);
    if (existing) {
      return Promise.resolve(existing);
    }
    if (this.options.failCharge) {
      return Promise.reject(new Error('StubPaymentGateway: charge en échec (panne simulée)'));
    }
    const result: ChargeResult = {
      chargeId: `stub_ch_${request.idempotencyKey}`,
      status: 'SUCCEEDED',
    };
    this.charges.set(request.idempotencyKey, result);
    return Promise.resolve(result);
  }

  refund(request: RefundRequest): Promise<RefundResult> {
    const existing = this.refunds.get(request.idempotencyKey);
    if (existing) {
      return Promise.resolve(existing);
    }
    const result: RefundResult = {
      refundId: `stub_re_${request.idempotencyKey}`,
      status: 'REFUNDED',
    };
    this.refunds.set(request.idempotencyKey, result);
    return Promise.resolve(result);
  }
}
