import {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from '../../application/ports/PaymentGateway';
import { CircuitBreaker } from '../../../../shared/resilience/circuit-breaker';
import { withRetry } from '../../../../shared/resilience/with-retry';
import { withTimeout } from '../../../../shared/resilience/with-timeout';

export interface PaymentResilienceOptions {
  timeoutMs: number;
  retries: number;
  baseDelayMs: number;
}

export class ResilientPaymentGateway implements PaymentGateway {
  constructor(
    private readonly inner: PaymentGateway,
    private readonly breaker: CircuitBreaker,
    private readonly options: PaymentResilienceOptions,
  ) {}

  charge(request: ChargeRequest): Promise<ChargeResult> {
    return this.harden(() => this.inner.charge(request));
  }

  refund(request: RefundRequest): Promise<RefundResult> {
    return this.harden(() => this.inner.refund(request));
  }

  private harden<T>(call: () => Promise<T>): Promise<T> {
    return this.breaker.call(() =>
      withRetry(() => withTimeout(call, this.options.timeoutMs), {
        retries: this.options.retries,
        baseDelayMs: this.options.baseDelayMs,
      }),
    );
  }
}
