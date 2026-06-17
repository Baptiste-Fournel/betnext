export class Odds {
  static readonly MIN = 1.1;
  static readonly MAX = 5.0;

  private constructor(public readonly value: number) {}

  static of(value: number): Odds {
    if (!Number.isFinite(value)) {
      throw new RangeError('Odds must be a finite number');
    }
    if (value < Odds.MIN || value > Odds.MAX) {
      throw new RangeError(`Odds ${value} out of range [${Odds.MIN}, ${Odds.MAX}]`);
    }
    return new Odds(round2(value));
  }

  static fromRatio(ratio: number): Odds {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return new Odds(Odds.MAX);
    }
    return new Odds(round2(Math.min(Odds.MAX, Math.max(Odds.MIN, ratio))));
  }

  equals(other: Odds): boolean {
    return this.value === other.value;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
