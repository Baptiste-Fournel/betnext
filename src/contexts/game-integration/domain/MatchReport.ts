export type MatchOutcomeSide = 'HOME' | 'AWAY' | 'DRAW';

export interface MatchReport {
  matchId: string;
  status: 'PENDING' | 'FINISHED';
  winner: MatchOutcomeSide | null;
}
