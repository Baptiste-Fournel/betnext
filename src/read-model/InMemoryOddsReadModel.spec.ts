import { InMemoryOddsReadModel } from './InMemoryOddsReadModel';

describe('InMemoryOddsReadModel (garde monotone anti out-of-order)', () => {
  it('un snapshot plus ANCIEN n écrase pas une cote plus récente ; un plus récent s applique', async () => {
    const rm = new InMemoryOddsReadModel();
    await rm.put([{ outcomeId: 'o1', odds: 4 }], 100);
    await rm.put([{ outcomeId: 'o1', odds: 9 }], 50); // occurredAt plus ancien → ignoré
    expect(await rm.current('o1')).toBe(4);
    await rm.put([{ outcomeId: 'o1', odds: 5 }], 150); // plus récent → appliqué
    expect(await rm.current('o1')).toBe(5);
  });

  it('cold cache → null', async () => {
    expect(await new InMemoryOddsReadModel().current('inconnu')).toBeNull();
  });
});
