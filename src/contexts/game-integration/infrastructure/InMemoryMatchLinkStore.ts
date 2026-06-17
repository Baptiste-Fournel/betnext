import { MatchLink, MatchLinkStore } from '../application/ports/MatchLinkStore';

/**
 * Store en mémoire des liens match↔marché. CHOIX POC ASSUMÉ : métadonnée d'intégration NON persistée
 * (ré-enregistrable), gardée hors Postgres pour que Riot reste isolé dans son module (aucun schéma /
 * migration / contrat partagé touché). Le RÈGLEMENT, lui, passe par le money-path Postgres (BET-12).
 */
export class InMemoryMatchLinkStore implements MatchLinkStore {
  private readonly links = new Map<string, MatchLink>();

  async save(link: MatchLink): Promise<void> {
    this.links.set(link.matchId, link);
  }

  async find(matchId: string): Promise<MatchLink | null> {
    return this.links.get(matchId) ?? null;
  }
}
