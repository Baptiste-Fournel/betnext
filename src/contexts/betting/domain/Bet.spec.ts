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
  it('shouldKeepLockedOdds_WhenMarketMovesAfterPlacement', () => {
    // Arrange
    const bet = Bet.place(base());
    expect(bet.lockedOdds.value).toBe(2);
    expect(bet.potentialGain).toBe(20);

    // Act
    const movedMarket = Odds.of(3.5);

    // Assert
    expect(bet.lockedOdds.value).toBe(2);
    expect(movedMarket.value).toBe(3.5);
  });

  it('shouldThrow_WhenStakeNotStrictlyPositive', () => {
    // Act / Assert
    expect(() => Bet.place({ ...base(), stake: 0 })).toThrow();
  });

  it('shouldEmitBetPlacedEvent_WhenPlaced', () => {
    // Act
    const events = Bet.place(base()).pullEvents();

    // Assert
    expect(events.map((e) => e.type)).toEqual(['BetPlaced']);
  });

  it('shouldTransitionToWonAndRejectIllegalTransition_WhenWinCalledTwice', () => {
    // Arrange
    const bet = Bet.place(base());

    // Act
    bet.win();

    // Assert
    expect(bet.status).toBe(BetStatus.Won);
    expect(() => bet.win()).toThrow();
  });
});
