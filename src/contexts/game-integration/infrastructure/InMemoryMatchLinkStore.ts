import { MatchLink, MatchLinkStore } from '../application/ports/MatchLinkStore';

export class InMemoryMatchLinkStore implements MatchLinkStore {
  private readonly links = new Map<string, MatchLink>();

  async save(link: MatchLink): Promise<void> {
    this.links.set(link.matchId, link);
  }

  async find(matchId: string): Promise<MatchLink | null> {
    return this.links.get(matchId) ?? null;
  }

  async list(): Promise<MatchLink[]> {
    return [...this.links.values()];
  }
}
