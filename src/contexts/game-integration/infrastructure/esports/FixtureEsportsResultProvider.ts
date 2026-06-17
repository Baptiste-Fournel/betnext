import { GameProvider } from '../../application/ports/GameProvider';
import { MatchOutcomeSide, MatchReport } from '../../domain/MatchReport';

const FINISHED_FIXTURES: Readonly<Record<string, MatchOutcomeSide>> = {
  'esports-fixture-lec-g2-fnc': 'HOME',
};

export class FixtureEsportsResultProvider implements GameProvider {
  async fetchMatchReport(matchId: string): Promise<MatchReport> {
    const winner = FINISHED_FIXTURES[matchId];
    if (!winner) {
      return { matchId, status: 'PENDING', winner: null };
    }
    return { matchId, status: 'FINISHED', winner };
  }
}
