import { MatchLinkStore } from './ports/MatchLinkStore';

export interface UpcomingMatch {
  matchId: string;
  marketId: string;
  league: string | null;
  startTime: string | null;
}

export class ListUpcomingMatches {
  constructor(private readonly links: MatchLinkStore) {}

  async execute(): Promise<UpcomingMatch[]> {
    const links = await this.links.list();
    return links
      .filter((link): link is typeof link & { marketId: string } => Boolean(link.marketId))
      .map((link) => ({
        matchId: link.matchId,
        marketId: link.marketId,
        league: link.league ?? null,
        startTime: link.startTime ?? null,
      }));
  }
}
