import { OddsReadController } from './OddsReadController';
import { InMemoryOddsReadModel } from './InMemoryOddsReadModel';
import { OPENING_ODDS_VALUE } from '../shared-kernel/domain/OpeningOdds';

describe('OddsReadController (current odds — read-model + opening line)', () => {
  it('shouldReturnOpeningOddsFlaggedOpening_WhenReadModelCold', async () => {
    // Arrange
    const controller = new OddsReadController(new InMemoryOddsReadModel());

    // Act
    const result = await controller.current('lol-finale-a');

    // Assert
    expect(result).toEqual({ outcomeId: 'lol-finale-a', odds: OPENING_ODDS_VALUE, opening: true });
  });

  it('shouldReturnProjectedOddsNotFlaggedOpening_WhenReadModelWarm', async () => {
    // Arrange
    const readModel = new InMemoryOddsReadModel();
    await readModel.put([{ outcomeId: 'lol-finale-a', odds: 3.2 }], 1_000);
    const controller = new OddsReadController(readModel);

    // Act
    const result = await controller.current('lol-finale-a');

    // Assert
    expect(result).toEqual({ outcomeId: 'lol-finale-a', odds: 3.2, opening: false });
  });
});
