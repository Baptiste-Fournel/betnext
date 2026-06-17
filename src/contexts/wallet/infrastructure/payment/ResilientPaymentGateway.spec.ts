import { ResilientPaymentGateway } from './ResilientPaymentGateway';
import { CircuitBreaker, CircuitOpenError } from '../../../../shared/resilience/circuit-breaker';
import {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
  RefundRequest,
  RefundResult,
} from '../../application/ports/PaymentGateway';

const charge = (key = 'deposit:d1'): ChargeRequest => ({
  amount: 50,
  currency: 'eur',
  idempotencyKey: key,
  reference: 'p1:d1',
});

class CountingGateway implements PaymentGateway {
  charges = 0;
  constructor(private readonly mode: 'ok' | 'down') {}
  charge(_request: ChargeRequest): Promise<ChargeResult> {
    this.charges += 1;
    if (this.mode === 'down') return Promise.reject(new Error('stripe 500'));
    return Promise.resolve({ chargeId: 'ch_x', status: 'SUCCEEDED' });
  }
  refund(_request: RefundRequest): Promise<RefundResult> {
    return Promise.resolve({ refundId: 're_x', status: 'REFUNDED' });
  }
}

describe('ResilientPaymentGateway (BET-17) — durcissement des appels PSP (défi 3)', () => {
  it('shouldOpenCircuitAndFailFast_WhenStripeKeepsFailing', async () => {
    // Arrange
    const inner = new CountingGateway('down');
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 10_000,
      now: () => 0,
    });
    const gateway = new ResilientPaymentGateway(inner, breaker, {
      timeoutMs: 1_000,
      retries: 0,
      baseDelayMs: 1,
    });

    // Act
    await expect(gateway.charge(charge())).rejects.toThrow('stripe 500');
    await expect(gateway.charge(charge())).rejects.toThrow('stripe 500');

    // Assert
    await expect(gateway.charge(charge())).rejects.toBeInstanceOf(CircuitOpenError);
    expect(breaker.currentState).toBe('OPEN');
    expect(inner.charges).toBe(2);
  });

  it('shouldRetryThenSucceed_WhenTransientStripeError', async () => {
    // Arrange
    let calls = 0;
    const inner: PaymentGateway = {
      charge: (): Promise<ChargeResult> => {
        calls += 1;
        return calls < 2
          ? Promise.reject(new Error('transient'))
          : Promise.resolve({ chargeId: 'ch_ok', status: 'SUCCEEDED' });
      },
      refund: (): Promise<RefundResult> =>
        Promise.resolve({ refundId: 're_x', status: 'REFUNDED' }),
    };
    const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10_000 });
    const gateway = new ResilientPaymentGateway(inner, breaker, {
      timeoutMs: 1_000,
      retries: 2,
      baseDelayMs: 1,
    });

    // Act / Assert
    await expect(gateway.charge(charge())).resolves.toMatchObject({ status: 'SUCCEEDED' });
    expect(calls).toBe(2);
  });
});
