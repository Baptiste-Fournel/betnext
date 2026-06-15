import { ReadModelOddsProvider, OPENING_ODDS } from './ReadModelOddsProvider';
import { InMemoryOddsReadModel } from '../../../read-model/InMemoryOddsReadModel';

describe('ReadModelOddsProvider (cote courante lue depuis le read-model)', () => {
  it('cold cache (aucun OddsUpdated projeté) → cote d ouverture par défaut, signalée provisoire', async () => {
    const provider = new ReadModelOddsProvider(new InMemoryOddsReadModel());
    const result = await provider.currentOdds('o1');
    expect(result.value.value).toBe(OPENING_ODDS);
    expect(result.provisional).toBe(true);
  });

  it('warm → renvoie la cote projetée par OddsUpdated (jamais la base d écriture), non provisoire', async () => {
    const readModel = new InMemoryOddsReadModel();
    await readModel.put([{ outcomeId: 'o1', odds: 3.5 }], Date.now());
    const provider = new ReadModelOddsProvider(readModel);
    const result = await provider.currentOdds('o1');
    expect(result.value.value).toBe(3.5);
    expect(result.provisional).toBe(false);
  });
});
