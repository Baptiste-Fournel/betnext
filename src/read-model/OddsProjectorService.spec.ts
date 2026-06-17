import { OddsProjectorService } from './OddsProjectorService';
import { InMemoryOddsReadModel } from './InMemoryOddsReadModel';
import { OddsStream, OddsLiveEvent } from './OddsStream';

describe('OddsProjectorService.project (OddsUpdated → read-model + flux live ; pas de polling)', () => {
  it('shouldUpdateReadModelAndPushEachOddsToStream_WhenOddsUpdated', async () => {
    // Arrange
    const readModel = new InMemoryOddsReadModel();
    const stream = new OddsStream();
    const live: OddsLiveEvent[] = [];
    stream.asObservable().subscribe((e) => live.push(e));
    const projector = new OddsProjectorService(readModel, stream);

    // Act
    await projector.project({
      type: 'OddsUpdated',
      occurredAt: new Date().toISOString(),
      updates: [
        { outcomeId: 'A', odds: 4 },
        { outcomeId: 'B', odds: 1.33 },
      ],
    });

    // Assert
    expect(await readModel.current('A')).toBe(4);
    expect(live).toEqual([
      { outcomeId: 'A', odds: 4 },
      { outcomeId: 'B', odds: 1.33 },
    ]);
  });

  it('shouldTouchNeitherReadModelNorStream_WhenEventIsNotOddsUpdated', async () => {
    // Arrange
    const readModel = new InMemoryOddsReadModel();
    const stream = new OddsStream();
    const live: OddsLiveEvent[] = [];
    stream.asObservable().subscribe((e) => live.push(e));

    // Act
    await new OddsProjectorService(readModel, stream).project({
      type: 'Autre',
      updates: [{ outcomeId: 'A', odds: 9 }],
    });

    // Assert
    expect(live).toEqual([]);
    expect(await readModel.current('A')).toBeNull();
  });
});
