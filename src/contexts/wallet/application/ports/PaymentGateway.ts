export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

export interface ChargeRequest {
  amount: number;
  currency: string;
  idempotencyKey: string;
  reference: string;
}

export interface ChargeResult {
  chargeId: string;
  status: 'SUCCEEDED';
}

export interface RefundRequest {
  chargeId: string;
  amount: number;
  idempotencyKey: string;
}

export interface RefundResult {
  refundId: string;
  status: 'REFUNDED';
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
}
