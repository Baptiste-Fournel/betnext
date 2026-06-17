import { MatchOutcomeSide } from '../../domain/MatchReport';

export interface MatchLink {
  matchId: string;
  outcomes: string[];
  mapping: Partial<Record<MatchOutcomeSide, string>>;
}

export const MATCH_LINK_STORE = Symbol('MatchLinkStore');

export interface MatchLinkStore {
  save(link: MatchLink): Promise<void>;
  find(matchId: string): Promise<MatchLink | null>;
}
