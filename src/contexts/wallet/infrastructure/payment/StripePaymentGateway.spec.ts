import { StripePaymentGateway, FetchLike } from './StripePaymentGateway';

const SECRET = 'sk_test_SECRET_DO_NOT_LEAK';

interface Captured {
  url: string;
  init: { method?: string; headers?: Record<string, string>; body?: string };
}

const fakeFetch = (status: number, json: unknown, sink: Captured[]): FetchLike => {
  return (url, init) => {
    sink.push({ url: String(url), init: (init ?? {}) as Captured['init'] });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(json),
    });
  };
};

describe('StripePaymentGateway (BET-17) — real adapter (test mode), anti-corruption ACL', () => {
  it('shouldMapToDomainShapeWithoutLeakingStripeFields_WhenChargeSucceeds', async () => {
    // Arrange
    const calls: Captured[] = [];
    const stripeRaw = {
      id: 'pi_123',
      object: 'payment_intent',
      status: 'succeeded',
      amount: 5000,
      currency: 'eur',
      client_secret: 'pi_123_secret_zzz',
      latest_charge: 'ch_999',
    };
    const gateway = new StripePaymentGateway(SECRET, fakeFetch(200, stripeRaw, calls));

    // Act
    const result = await gateway.charge({
      amount: 50,
      currency: 'eur',
      idempotencyKey: 'deposit:d1',
      reference: 'p1:d1',
    });

    // Assert
    expect(Object.keys(result).sort()).toEqual(['chargeId', 'status']);
    expect(result).toEqual({ chargeId: 'pi_123', status: 'SUCCEEDED' });
  });

  it('shouldConvertEurosToCentsAndSendIdempotencyKey_WhenCharging', async () => {
    // Arrange
    const calls: Captured[] = [];
    const gateway = new StripePaymentGateway(
      SECRET,
      fakeFetch(200, { id: 'pi_1', status: 'succeeded' }, calls),
    );

    // Act
    await gateway.charge({
      amount: 50,
      currency: 'eur',
      idempotencyKey: 'deposit:d1',
      reference: 'p1:d1',
    });

    // Assert
    const { url, init } = calls[0];
    expect(url).toContain('/v1/payment_intents');
    expect(init.body).toContain('amount=5000');
    expect(init.headers?.['Idempotency-Key']).toBe('deposit:d1');
    expect(init.headers?.Authorization).toBe(`Bearer ${SECRET}`);
  });

  it('shouldThrowWithoutLeakingSecret_WhenStripeReturnsError', async () => {
    // Arrange
    const calls: Captured[] = [];
    const gateway = new StripePaymentGateway(
      SECRET,
      fakeFetch(402, { error: { message: 'card declined' } }, calls),
    );

    // Act
    let captured: Error | null = null;
    try {
      await gateway.charge({
        amount: 50,
        currency: 'eur',
        idempotencyKey: 'deposit:d1',
        reference: 'p1:d1',
      });
    } catch (e) {
      captured = e as Error;
    }

    // Assert
    expect(captured).toBeInstanceOf(Error);
    expect(captured?.message).not.toContain(SECRET);
  });

  it('shouldThrow_WhenChargeNotSucceeded', async () => {
    // Arrange
    const calls: Captured[] = [];
    const gateway = new StripePaymentGateway(
      SECRET,
      fakeFetch(200, { id: 'pi_x', status: 'requires_action' }, calls),
    );

    // Act / Assert
    await expect(
      gateway.charge({
        amount: 50,
        currency: 'eur',
        idempotencyKey: 'deposit:d1',
        reference: 'p1:d1',
      }),
    ).rejects.toThrow();
  });

  it('shouldRefundByPaymentIntentWithIdempotencyKey_WhenRefunding', async () => {
    // Arrange
    const calls: Captured[] = [];
    const gateway = new StripePaymentGateway(
      SECRET,
      fakeFetch(200, { id: 're_1', status: 'succeeded' }, calls),
    );

    // Act
    const result = await gateway.refund({
      chargeId: 'pi_123',
      amount: 50,
      idempotencyKey: 'refund:d1',
    });

    // Assert
    expect(Object.keys(result).sort()).toEqual(['refundId', 'status']);
    expect(result).toEqual({ refundId: 're_1', status: 'REFUNDED' });
    const { url, init } = calls[0];
    expect(url).toContain('/v1/refunds');
    expect(init.body).toContain('payment_intent=pi_123');
    expect(init.headers?.['Idempotency-Key']).toBe('refund:d1');
  });
});
