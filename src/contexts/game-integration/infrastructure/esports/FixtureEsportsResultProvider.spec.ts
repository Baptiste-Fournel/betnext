import { FixtureEsportsResultProvider } from './FixtureEsportsResultProvider';

describe('FixtureEsportsResultProvider (BET-32)', () => {
  it('shouldReportFinishedWinner_WhenMatchIsADemoFinishedFixture', async () => {
    // Act
    const report = await new FixtureEsportsResultProvider().fetchMatchReport(
      'esports-fixture-lec-g2-fnc',
    );

    // Assert
    expect(report).toEqual({
      matchId: 'esports-fixture-lec-g2-fnc',
      status: 'FINISHED',
      winner: 'HOME',
    });
  });

  it('shouldReportPending_WhenMatchIsStillUpcoming', async () => {
    // Act
    const report = await new FixtureEsportsResultProvider().fetchMatchReport(
      'esports-fixture-lck-t1-geng',
    );

    // Assert
    expect(report).toEqual({
      matchId: 'esports-fixture-lck-t1-geng',
      status: 'PENDING',
      winner: null,
    });
  });
});
