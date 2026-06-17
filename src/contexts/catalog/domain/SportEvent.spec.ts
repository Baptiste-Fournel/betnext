import { SportEvent } from './SportEvent';
import { Outcome } from './Outcome';

describe('SportEvent (generic N-outcome catalogue)', () => {
  it('shouldSupportThreeOutcomeMarketWithoutTeamABModel_WhenWinAWinBDrawAdded', () => {
    // Arrange
    const ev = new SportEvent('e1', 'T1 vs BLG', 'League of Legends')
      .addOutcome(new Outcome('A', 'T1'))
      .addOutcome(new Outcome('B', 'BLG'))
      .addOutcome(new Outcome('draw', 'Nul'));

    // Act / Assert
    expect(ev.outcomes.map((o) => o.id)).toEqual(['A', 'B', 'draw']);
  });

  it('shouldThrow_WhenDuplicateOutcomeAdded', () => {
    // Arrange
    const ev = new SportEvent('e1', 'x', 'LoL').addOutcome(new Outcome('A', 'A'));

    // Act / Assert
    expect(() => ev.addOutcome(new Outcome('A', 'A2'))).toThrow();
  });
});
