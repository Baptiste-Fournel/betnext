export class Wallet {
  private readonly applied = new Set<string>();

  constructor(private _balance: number = 0) {}

  get balance(): number {
    return this._balance;
  }

  debit(amount: number, opKey: string): void {
    this.assertPositive(amount);
    if (this.applied.has(opKey)) return;
    if (amount > this._balance) {
      throw new Error('Insufficient balance');
    }
    this._balance -= amount;
    this.applied.add(opKey);
  }

  credit(amount: number, opKey: string): void {
    this.assertPositive(amount);
    if (this.applied.has(opKey)) return;
    this._balance += amount;
    this.applied.add(opKey);
  }

  refund(amount: number, opKey: string): void {
    this.credit(amount, opKey);
  }

  private assertPositive(amount: number): void {
    if (!(amount > 0)) {
      throw new RangeError('Amount must be strictly positive');
    }
  }
}
