import { MatchOutcomeSide } from '../../domain/MatchReport';

// Lien match ↔ marché bettable posé par l'ingestion du feed (BET-30). Clé = id externe du
// match (idempotence). Porte le mapping côté→issue + les issues (consommés par le moteur de
// règlement-par-résultat `SyncMatchResult`, réutilisé par le futur driver « résultats auto »),
// ainsi que la ligue + le kickoff pour l'affichage « à venir ».
export interface MatchLink {
  matchId: string;
  outcomes: string[];
  mapping: Partial<Record<MatchOutcomeSide, string>>;
  marketId?: string;
  region?: string;
  league?: string;
  startTime?: string;
}

export const MATCH_LINK_STORE = Symbol('MatchLinkStore');

export interface MatchLinkStore {
  save(link: MatchLink): Promise<void>;
  find(matchId: string): Promise<MatchLink | null>;
  list(): Promise<MatchLink[]>;
}
