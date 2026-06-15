import { Bet } from './Bet';
import { BetStatus } from './BetStatus';
import { Odds } from '../../../shared-kernel/domain/Odds';

const base = () => ({
  id: 'b1',
  userId: 'u1',
  outcomeId: 'o1',
  stake: 10,
  currentOdds: Odds.of(2),
});

describe('Bet (agrégat)', () => {
  it('fige la cote à la pose : un mouvement de marché ultérieur ne change pas le pari', () => {
    const bet = Bet.place(base());
    expect(bet.lockedOdds.value).toBe(2);
    expect(bet.potentialGain).toBe(20);

    // le marché bouge plus tard...
    const movedMarket = Odds.of(3.5);
    // ...mais le pari déjà posé est inchangé
    expect(bet.lockedOdds.value).toBe(2);
    expect(movedMarket.value).toBe(3.5);
  });

  it('refuse une mise non strictement positive', () => {
    expect(() => Bet.place({ ...base(), stake: 0 })).toThrow();
  });

  it('émet un événement BetPlaced à la pose', () => {
    const events = Bet.place(base()).pullEvents();
    expect(events.map((e) => e.type)).toEqual(['BetPlaced']);
  });

  it('passe de PENDING à WON et garde les transitions illégales', () => {
    const bet = Bet.place(base());
    bet.win();
    expect(bet.status).toBe(BetStatus.Won);
    expect(() => bet.win()).toThrow(); // déjà réglé
  });
});
