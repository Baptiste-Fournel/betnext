import { ReadModelOddsProvider, OPENING_ODDS } from './ReadModelOddsProvider';
import { InMemoryOddsReadModel } from '../../../read-model/InMemoryOddsReadModel';
import { openingOdds } from '../../../shared-kernel/domain/OpeningOdds';

describe('ReadModelOddsProvider (cote courante lue depuis le read-model)', () => {
  it('shouldReturnOpeningOddsMarkedProvisional_WhenCacheCold', async () => {
    // Arrange
    const provider = new ReadModelOddsProvider(new InMemoryOddsReadModel());

    // Act
    const result = await provider.currentOdds('o1');

    // Assert
    expect(result.value.value).toBe(OPENING_ODDS);
    expect(result.provisional).toBe(true);
  });

  it('shouldLockTheSameOpeningOddsAsDisplay_WhenCold', async () => {
    // Arrange
    const provider = new ReadModelOddsProvider(new InMemoryOddsReadModel());

    // Act
    const result = await provider.currentOdds('o1');

    // Assert — money-safety : la cote figée au pari == la ligne d'ouverture affichée (source unique)
    expect(result.value.value).toBe(openingOdds().value);
  });

  it('shouldReturnProjectedOddsNotProvisional_WhenCacheWarm', async () => {
    // Arrange
    const readModel = new InMemoryOddsReadModel();
    await readModel.put([{ outcomeId: 'o1', odds: 3.5 }], Date.now());
    const provider = new ReadModelOddsProvider(readModel);

    // Act
    const result = await provider.currentOdds('o1');

    // Assert
    expect(result.value.value).toBe(3.5);
    expect(result.provisional).toBe(false);
  });
});
