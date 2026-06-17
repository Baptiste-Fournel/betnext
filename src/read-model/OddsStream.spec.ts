import { OddsStream } from './OddsStream';

describe('OddsStream (flux in-process des cotes)', () => {
  it('shouldPublishOddsToSubscriber_WhenOddsPublished', () => {
    // Arrange
    const stream = new OddsStream();
    const received: Array<{ outcomeId: string; odds: number }> = [];
    const sub = stream.asObservable().subscribe((e) => received.push(e));

    // Act
    stream.publish({ outcomeId: 'A', odds: 3 });
    stream.publish({ outcomeId: 'B', odds: 1.5 });
    sub.unsubscribe();

    // Assert
    expect(received).toEqual([
      { outcomeId: 'A', odds: 3 },
      { outcomeId: 'B', odds: 1.5 },
    ]);
  });

  it('shouldReceiveNothing_WhenSubscriberHasUnsubscribed', () => {
    // Arrange
    const stream = new OddsStream();
    const received: unknown[] = [];
    const sub = stream.asObservable().subscribe((e) => received.push(e));

    // Act
    sub.unsubscribe();
    stream.publish({ outcomeId: 'A', odds: 2 });

    // Assert
    expect(received).toHaveLength(0);
  });
});
