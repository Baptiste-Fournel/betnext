import { SportEvent } from './SportEvent';
import { Outcome } from './Outcome';

describe('SportEvent (catalogue générique N-issues)', () => {
  it('supporte un marché à 3 issues (victoire A / victoire B / nul) sans modèle teamA/teamB', () => {
    const ev = new SportEvent('e1', 'T1 vs BLG', 'League of Legends')
      .addOutcome(new Outcome('A', 'T1'))
      .addOutcome(new Outcome('B', 'BLG'))
      .addOutcome(new Outcome('draw', 'Nul'));
    expect(ev.outcomes.map((o) => o.id)).toEqual(['A', 'B', 'draw']);
  });

  it('refuse une issue en double', () => {
    const ev = new SportEvent('e1', 'x', 'LoL').addOutcome(new Outcome('A', 'A'));
    expect(() => ev.addOutcome(new Outcome('A', 'A2'))).toThrow();
  });
});
