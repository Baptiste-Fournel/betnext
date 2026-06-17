/**
 * Port (infra) du client Riot. Renvoie un payload NORMALISÉ ; la shape BRUTE de l'API Riot (match-v5)
 * est confinée à `HttpRiotClient`. Stubable → testable sans réseau ni clé. L'ACL (`RiotGameProvider`)
 * traduit ce payload → `MatchReport` interne.
 */
export const RIOT_CLIENT = Symbol('RiotClient');

export interface RiotMatchPayload {
  matchId: string;
  /** false = match pas (encore) disponible/joué → l'ACL en fera un PENDING. */
  finished: boolean;
  teams: Array<{ teamId: number; win: boolean }>;
}

export interface RiotClient {
  getMatch(matchId: string): Promise<RiotMatchPayload>;
}
