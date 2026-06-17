export const RIOT_CLIENT = Symbol('RiotClient');

export interface RiotMatchPayload {
  matchId: string;
  finished: boolean;
  teams: Array<{ teamId: number; win: boolean }>;
}

export interface RiotClient {
  getMatch(matchId: string): Promise<RiotMatchPayload>;
}
