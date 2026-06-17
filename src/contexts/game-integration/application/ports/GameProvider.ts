import { MatchReport } from '../../domain/MatchReport';

export const GAME_PROVIDER = Symbol('GameProvider');

export interface GameProvider {
  fetchMatchReport(matchId: string): Promise<MatchReport>;
}
