import { RiotGameProvider } from './RiotGameProvider';
import { RiotClient, RiotMatchPayload } from './riot/RiotClient';

const clientReturning = (payload: RiotMatchPayload): RiotClient => ({
  getMatch: async () => payload,
});

describe('RiotGameProvider — ACL Riot → modèle interne (BET-21)', () => {
  it('shouldMapWinnerToHome_WhenTeam100Wins', async () => {
    // Act
    const report = await new RiotGameProvider(
      clientReturning({
        matchId: 'm',
        finished: true,
        teams: [
          { teamId: 100, win: true },
          { teamId: 200, win: false },
        ],
      }),
    ).fetchMatchReport('m');

    // Assert
    expect(report).toEqual({ matchId: 'm', status: 'FINISHED', winner: 'HOME' });
  });

  it('shouldMapWinnerToAway_WhenTeam200Wins', async () => {
    // Act
    const report = await new RiotGameProvider(
      clientReturning({
        matchId: 'm',
        finished: true,
        teams: [
          { teamId: 100, win: false },
          { teamId: 200, win: true },
        ],
      }),
    ).fetchMatchReport('m');

    // Assert
    expect(report.winner).toBe('AWAY');
  });

  it('shouldMapWinnerToDraw_WhenMatchFinishedWithoutWinner', async () => {
    // Act
    const report = await new RiotGameProvider(
      clientReturning({
        matchId: 'm',
        finished: true,
        teams: [
          { teamId: 100, win: false },
          { teamId: 200, win: false },
        ],
      }),
    ).fetchMatchReport('m');

    // Assert
    expect(report.winner).toBe('DRAW');
  });

  it('shouldReturnPendingWithoutError_WhenMatchNotAvailable', async () => {
    // Act
    const report = await new RiotGameProvider(
      clientReturning({ matchId: 'm', finished: false, teams: [] }),
    ).fetchMatchReport('m');

    // Assert
    expect(report).toEqual({ matchId: 'm', status: 'PENDING', winner: null });
  });

  it('shouldThrowAndNotSettleWrongSide_WhenTeamIdOutsideConvention', async () => {
    // Act / Assert
    await expect(
      new RiotGameProvider(
        clientReturning({
          matchId: 'm',
          finished: true,
          teams: [
            { teamId: 300, win: true },
            { teamId: 0, win: false },
          ],
        }),
      ).fetchMatchReport('m'),
    ).rejects.toThrow(/teamId Riot inattendu/);
  });
});
