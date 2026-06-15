import { OddsCalculator } from './OddsCalculator';
import { Odds } from '../../../shared-kernel/domain/Odds';

describe('OddsCalculator (pari-mutuel, N-issues)', () => {
  const calc = new OddsCalculator();

  it('produit des cotes équilibrées quand les mises sont égales', () => {
    const odds = calc.compute(
      new Map([
        ['A', 100],
        ['B', 100],
      ]),
    );
    expect(odds.get('A')!.value).toBe(2); // 200 / 100
    expect(odds.get('B')!.value).toBe(2);
  });

  it("borne le favori au minimum et l'outsider au maximum", () => {
    const odds = calc.compute(
      new Map([
        ['fav', 1000],
        ['outsider', 10],
      ]),
    );
    expect(odds.get('fav')!.value).toBe(Odds.MIN); // 1010/1000 ≈ 1.01 -> 1.10
    expect(odds.get('outsider')!.value).toBe(Odds.MAX); // 1010/10 = 101 -> 5.00
  });

  it('donne la cote maximale à une issue sans mise', () => {
    const odds = calc.compute(
      new Map([
        ['A', 100],
        ['draw', 0],
      ]),
    );
    expect(odds.get('draw')!.value).toBe(Odds.MAX);
  });

  it('supporte un marché à 3 issues (victoire A / victoire B / nul)', () => {
    const odds = calc.compute(
      new Map([
        ['A', 100],
        ['B', 100],
        ['draw', 100],
      ]),
    );
    expect(odds.size).toBe(3);
    expect(odds.get('A')!.value).toBe(3); // 300 / 100
  });
});
