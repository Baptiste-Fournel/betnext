import { OddsStream } from './OddsStream';

describe('OddsStream (flux in-process des cotes)', () => {
  it('publie les cotes à chaque abonné', () => {
    const stream = new OddsStream();
    const received: Array<{ outcomeId: string; odds: number }> = [];
    const sub = stream.asObservable().subscribe((e) => received.push(e));

    stream.publish({ outcomeId: 'A', odds: 3 });
    stream.publish({ outcomeId: 'B', odds: 1.5 });
    sub.unsubscribe();

    expect(received).toEqual([
      { outcomeId: 'A', odds: 3 },
      { outcomeId: 'B', odds: 1.5 },
    ]);
  });

  it('un abonné qui se désabonne ne reçoit plus rien (pas de fuite)', () => {
    const stream = new OddsStream();
    const received: unknown[] = [];
    const sub = stream.asObservable().subscribe((e) => received.push(e));
    sub.unsubscribe();
    stream.publish({ outcomeId: 'A', odds: 2 });
    expect(received).toHaveLength(0);
  });
});
