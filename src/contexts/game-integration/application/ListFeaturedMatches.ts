import { FeaturedMatch } from './FeatureRiotMatch';
import { MatchLinkStore } from './ports/MatchLinkStore';

export class ListFeaturedMatches {
  constructor(private readonly links: MatchLinkStore) {}

  async execute(): Promise<FeaturedMatch[]> {
    const links = await this.links.list();
    return links
      .filter((link): link is typeof link & { marketId: string } => Boolean(link.marketId))
      .map((link) => ({
        matchId: link.matchId,
        marketId: link.marketId,
        region: link.region ?? null,
        outcomes: link.outcomes,
        mapping: link.mapping,
      }));
  }
}
