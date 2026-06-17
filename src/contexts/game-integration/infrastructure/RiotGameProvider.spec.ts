import { RiotGameProvider } from './RiotGameProvider';
import { RiotClient, RiotMatchPayload } from './riot/RiotClient';

const clientReturning = (payload: RiotMatchPayload): RiotClient => ({
  getMatch: async () => payload,
});

describe('RiotGameProvider — ACL Riot → modèle interne (BET-21)', () => {
  it('équipe 100 gagnante → HOME', async () => {
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
    expect(report).toEqual({ matchId: 'm', status: 'FINISHED', winner: 'HOME' });
  });

  it('équipe 200 gagnante → AWAY', async () => {
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
    expect(report.winner).toBe('AWAY');
  });

  it('match fini sans vainqueur → DRAW', async () => {
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
    expect(report.winner).toBe('DRAW');
  });

  it('match non disponible → PENDING (pas une erreur)', async () => {
    const report = await new RiotGameProvider(
      clientReturning({ matchId: 'm', finished: false, teams: [] }),
    ).fetchMatchReport('m');
    expect(report).toEqual({ matchId: 'm', status: 'PENDING', winner: null });
  });

  it('teamId hors convention (ni 100 ni 200) → LÈVE, ne règle PAS le mauvais côté (sécurité argent)', async () => {
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
