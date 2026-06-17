import {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from '../../application/ports/PaymentGateway';

export interface StubPaymentGatewayOptions {
  // Force l'échec de toute charge — simule un PSP en panne (tests breaker + compensation).
  failCharge?: boolean;
}

// PSP factice DÉTERMINISTE : sert aux tests et à la démo SANS clé Stripe. Idempotent par clé
// (même clé → même résultat, jamais de double mouvement) — réplique la garantie d'idempotence du
// vrai Stripe (`Idempotency-Key`). Aucun appel réseau, aucun secret.
export class StubPaymentGateway implements PaymentGateway {
  private readonly charges = new Map<string, ChargeResult>();
  private readonly refunds = new Map<string, RefundResult>();

  constructor(private readonly options: StubPaymentGatewayOptions = {}) {}

  // Nombre de charges RÉELLES (distinctes) — un retry de même clé ne l'incrémente pas.
  get chargeCount(): number {
    return this.charges.size;
  }

  // Nombre de remboursements RÉELS (distincts).
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
