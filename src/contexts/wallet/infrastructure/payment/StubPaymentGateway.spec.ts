import { StubPaymentGateway } from './StubPaymentGateway';

describe('StubPaymentGateway (BET-17) — PSP déterministe, idempotent (tests + démo sans clé)', () => {
  it('shouldChargeOnceAndReturnDomainShape_WhenCharged', async () => {
    // Arrange
    const gateway = new StubPaymentGateway();

    // Act
    const result = await gateway.charge({
      amount: 50,
      currency: 'eur',
      idempotencyKey: 'deposit:d1',
      reference: 'player-1',
    });

    // Assert
    expect(result.status).toBe('SUCCEEDED');
    expect(typeof result.chargeId).toBe('string');
    expect(Object.keys(result).sort()).toEqual(['chargeId', 'status']);
    expect(gateway.chargeCount).toBe(1);
  });

  it('shouldNotDoubleCharge_WhenSameIdempotencyKeyRetried', async () => {
    // Arrange
    const gateway = new StubPaymentGateway();
    const req = {
      amount: 50,
      currency: 'eur',
      idempotencyKey: 'deposit:d1',
      reference: 'player-1',
    };

    // Act
    const first = await gateway.charge(req);
    const second = await gateway.charge(req);

    // Assert
    expect(second.chargeId).toBe(first.chargeId);
    expect(gateway.chargeCount).toBe(1);
  });

  it('shouldRejectCharge_WhenFailureInjected', async () => {
    // Arrange
    const gateway = new StubPaymentGateway({ failCharge: true });

    // Act / Assert
    await expect(
      gateway.charge({
        amount: 50,
        currency: 'eur',
        idempotencyKey: 'deposit:d1',
        reference: 'player-1',
      }),
    ).rejects.toThrow();
    expect(gateway.chargeCount).toBe(0);
  });

  it('shouldNotDoubleRefund_WhenSameIdempotencyKeyReplayed', async () => {
    // Arrange
    const gateway = new StubPaymentGateway();
    const charge = await gateway.charge({
      amount: 50,
      currency: 'eur',
      idempotencyKey: 'deposit:d1',
      reference: 'player-1',
    });
    const refundReq = { chargeId: charge.chargeId, amount: 50, idempotencyKey: 'refund:d1' };

    // Act
    const first = await gateway.refund(refundReq);
    const second = await gateway.refund(refundReq);

    // Assert
    expect(second.refundId).toBe(first.refundId);
    expect(second.status).toBe('REFUNDED');
    expect(gateway.refundCount).toBe(1);
  });
});
