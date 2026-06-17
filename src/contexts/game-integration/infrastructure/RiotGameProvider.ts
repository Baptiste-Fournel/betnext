import { GameProvider } from '../application/ports/GameProvider';
import { MatchOutcomeSide, MatchReport } from '../domain/MatchReport';
import { RiotClient } from './riot/RiotClient';

const RIOT_TEAM_TO_SIDE: Record<number, MatchOutcomeSide> = { 100: 'HOME', 200: 'AWAY' };

export class RiotGameProvider implements GameProvider {
  constructor(private readonly client: RiotClient) {}

  async fetchMatchReport(matchId: string): Promise<MatchReport> {
    const payload = await this.client.getMatch(matchId);
    if (!payload.finished) {
      return { matchId, status: 'PENDING', winner: null };
    }
    const winningTeam = payload.teams.find((t) => t.win);
    if (!winningTeam) {
      return { matchId, status: 'FINISHED', winner: 'DRAW' };
    }
    const winner = RIOT_TEAM_TO_SIDE[winningTeam.teamId];
    if (!winner) {
      throw new Error(`teamId Riot inattendu (${winningTeam.teamId}) — règlement refusé`);
    }
    return { matchId, status: 'FINISHED', winner };
  }
}
