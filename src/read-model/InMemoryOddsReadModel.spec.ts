import { InMemoryOddsReadModel } from './InMemoryOddsReadModel';

describe('InMemoryOddsReadModel (monotonic guard against out-of-order)', () => {
  it('shouldKeepRecentOddsAndApplyNewer_WhenSnapshotsArriveOutOfOrder', async () => {
    // Arrange
    const rm = new InMemoryOddsReadModel();

    // Act / Assert
    await rm.put([{ outcomeId: 'o1', odds: 4 }], 100);
    await rm.put([{ outcomeId: 'o1', odds: 9 }], 50);
    expect(await rm.current('o1')).toBe(4);
    await rm.put([{ outcomeId: 'o1', odds: 5 }], 150);
    expect(await rm.current('o1')).toBe(5);
  });

  it('shouldReturnNull_WhenCacheIsCold', async () => {
    // Act / Assert
    expect(await new InMemoryOddsReadModel().current('inconnu')).toBeNull();
  });
});
