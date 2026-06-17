import {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from '../../application/ports/PaymentGateway';

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

interface StripeObject {
  id?: string;
  status?: string;
  error?: { message?: string };
}

const STRIPE_API = 'https://api.stripe.com';

export class StripePaymentGateway implements PaymentGateway {
  constructor(
    private readonly secretKey: string,
    private readonly fetchFn: FetchLike = globalThis.fetch.bind(globalThis),
  ) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const body = new URLSearchParams({
      amount: String(this.toMinorUnits(request.amount)),
      currency: request.currency,
      confirm: 'true',
      payment_method: 'pm_card_visa',
      'automatic_payment_methods[enabled]': 'true',
      'automatic_payment_methods[allow_redirects]': 'never',
      description: `BetNext deposit ${request.reference}`,
    });
    const intent = await this.post('/v1/payment_intents', body, request.idempotencyKey, 'charge');
    if (intent.status !== 'succeeded' || !intent.id) {
      throw new Error(`Charge Stripe non aboutie (statut: ${intent.status ?? 'inconnu'})`);
    }
    return { chargeId: intent.id, status: 'SUCCEEDED' };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const body = new URLSearchParams({
      payment_intent: request.chargeId,
      amount: String(this.toMinorUnits(request.amount)),
    });
    const refund = await this.post('/v1/refunds', body, request.idempotencyKey, 'refund');
    if (!refund.id) {
      throw new Error('Refund Stripe sans identifiant');
    }
    return { refundId: refund.id, status: 'REFUNDED' };
  }

  private async post(
    path: string,
    body: URLSearchParams,
    idempotencyKey: string,
    op: string,
  ): Promise<StripeObject> {
    const res = await this.fetchFn(`${STRIPE_API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: body.toString(),
    });
    const payload = (await res.json().catch(() => ({}))) as StripeObject;
    if (!res.ok) {
      const detail = payload.error?.message ?? '';
      throw new Error(
        `Appel Stripe (${op}) en échec (HTTP ${res.status})${detail ? ` : ${detail}` : ''}`,
      );
    }
    return payload;
  }

  private toMinorUnits(amount: number): number {
    return Math.round(amount * 100);
  }
}
