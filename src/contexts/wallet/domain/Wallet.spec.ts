import { Wallet } from './Wallet';

describe('Wallet — idempotency (no double-debit / double-credit)', () => {
  it('shouldApplyDebitOnce_WhenSameOperationDeliveredTwice', () => {
    // Arrange
    const wallet = new Wallet(100);

    // Act
    wallet.debit(30, 'op-1');
    wallet.debit(30, 'op-1');

    // Assert
    expect(wallet.balance).toBe(70);
  });

  it('shouldNotDoubleCredit_WhenRefundReplayed', () => {
    // Arrange
    const wallet = new Wallet(0);

    // Act
    wallet.refund(50, 'refund-bet-1');
    wallet.refund(50, 'refund-bet-1');

    // Assert
    expect(wallet.balance).toBe(50);
  });

  it('shouldThrow_WhenDebitExceedsBalance', () => {
    // Arrange
    const wallet = new Wallet(10);

    // Act / Assert
    expect(() => wallet.debit(20, 'op-x')).toThrow();
  });
});
