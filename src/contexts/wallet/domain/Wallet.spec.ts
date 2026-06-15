import { Wallet } from './Wallet';

describe('Wallet — idempotence (zéro double-débit / double-crédit)', () => {
  it("n'applique un débit qu'une fois même si le message est livré deux fois", () => {
    const w = new Wallet(100);
    w.debit(30, 'op-1');
    w.debit(30, 'op-1'); // rejeu at-least-once
    expect(w.balance).toBe(70);
  });

  it('ne double-crédite pas un remboursement rejoué (sécurité de compensation)', () => {
    const w = new Wallet(0);
    w.refund(50, 'refund-bet-1');
    w.refund(50, 'refund-bet-1');
    expect(w.balance).toBe(50);
  });

  it('refuse un débit supérieur au solde', () => {
    const w = new Wallet(10);
    expect(() => w.debit(20, 'op-x')).toThrow();
  });
});
