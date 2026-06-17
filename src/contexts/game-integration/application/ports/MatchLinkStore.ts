import { MatchOutcomeSide } from '../../domain/MatchReport';

/**
 * Lien entre un match (externe) et un marché interne : la liste de SES issues (pour le règlement) et
 * le mapping côté-vainqueur → issue gagnante. C'est ce lien qui permet de régler le bon marché quand
 * un résultat arrive. (POC : porté par Game Integration, pas par Catalog → zéro couplage de contrat.)
 */
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
