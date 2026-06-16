import { OddsProjectorService } from './OddsProjectorService';
import { InMemoryOddsReadModel } from './InMemoryOddsReadModel';
import { OddsStream, OddsLiveEvent } from './OddsStream';

describe('OddsProjectorService.project (OddsUpdated → read-model + flux live ; pas de polling)', () => {
  it('met à jour le read-model ET pousse chaque cote sur le flux (même source)', async () => {
    const readModel = new InMemoryOddsReadModel();
    const stream = new OddsStream();
    const live: OddsLiveEvent[] = [];
    stream.asObservable().subscribe((e) => live.push(e));
    const projector = new OddsProjectorService(readModel, stream);

    await projector.project({
      type: 'OddsUpdated',
      occurredAt: new Date().toISOString(),
      updates: [
        { outcomeId: 'A', odds: 4 },
        { outcomeId: 'B', odds: 1.33 },
      ],
    });

    expect(await readModel.current('A')).toBe(4); // read-model mis à jour
    expect(live).toEqual([
      { outcomeId: 'A', odds: 4 },
      { outcomeId: 'B', odds: 1.33 },
    ]); // flux live alimenté par le MÊME OddsUpdated
  });

  it('ignore un event non-OddsUpdated (ni read-model, ni flux)', async () => {
    const readModel = new InMemoryOddsReadModel();
    const stream = new OddsStream();
    const live: OddsLiveEvent[] = [];
    stream.asObservable().subscribe((e) => live.push(e));

    await new OddsProjectorService(readModel, stream).project({
      type: 'Autre',
      updates: [{ outcomeId: 'A', odds: 9 }],
    });

    expect(live).toEqual([]);
    expect(await readModel.current('A')).toBeNull();
  });
});
