import { MatchReport } from '../../domain/MatchReport';

/**
 * Port du fournisseur de jeu (plugin). Renvoie un `MatchReport` INTERNE (déjà traduit par l'ACL) →
 * l'applicatif ne dépend pas de Riot. Un `RiotGameProvider` (infra) l'implémente derrière l'ACL +
 * la résilience ; d'autres fournisseurs (autre jeu) s'ajouteraient sans toucher l'applicatif.
 */
export const GAME_PROVIDER = Symbol('GameProvider');

export interface GameProvider {
  fetchMatchReport(matchId: string): Promise<MatchReport>;
}
