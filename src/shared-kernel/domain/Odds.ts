/**
 * Cote décimale (Value Object) — Shared Kernel car partagée par Pricing (calcul)
 * et Betting (cote figée). Immuable, bornée à [MIN, MAX] comme le domaine de référence
 * (OddsCalculatorService.php:11-13 / :44-45).
 */
export class Odds {
  static readonly MIN = 1.1;
  static readonly MAX = 5.0;

  private constructor(public readonly value: number) {}

  /** Valide une cote déjà connue (lève si hors bornes). */
  static of(value: number): Odds {
    if (!Number.isFinite(value)) {
      throw new RangeError('Odds must be a finite number');
    }
    if (value < Odds.MIN || value > Odds.MAX) {
      throw new RangeError(`Odds ${value} out of range [${Odds.MIN}, ${Odds.MAX}]`);
    }
    return new Odds(round2(value));
  }

  /** Construit une cote depuis un ratio pari-mutuel brut, en bornant dans l'intervalle. */
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
