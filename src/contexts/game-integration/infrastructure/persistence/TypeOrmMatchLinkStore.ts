import { DataSource } from 'typeorm';
import { MatchLink, MatchLinkStore } from '../../application/ports/MatchLinkStore';
import { MatchLinkRecord } from './MatchLinkRecord';

export class TypeOrmMatchLinkStore implements MatchLinkStore {
  constructor(private readonly dataSource: DataSource) {}

  async save(link: MatchLink): Promise<void> {
    await this.dataSource.getRepository(MatchLinkRecord).save({
      matchId: link.matchId,
      marketId: link.marketId ?? null,
      outcomes: link.outcomes,
      mapping: link.mapping,
      region: link.region ?? null,
      league: link.league ?? null,
      startTime: link.startTime ?? null,
    });
  }

  async find(matchId: string): Promise<MatchLink | null> {
    const row = await this.dataSource.getRepository(MatchLinkRecord).findOneBy({ matchId });
    return row ? this.toLink(row) : null;
  }

  async list(): Promise<MatchLink[]> {
    const rows = await this.dataSource.getRepository(MatchLinkRecord).find();
    return rows.map((row) => this.toLink(row));
  }

  private toLink(row: MatchLinkRecord): MatchLink {
    return {
      matchId: row.matchId,
      outcomes: row.outcomes,
      mapping: row.mapping,
      ...(row.marketId ? { marketId: row.marketId } : {}),
      ...(row.region ? { region: row.region } : {}),
      ...(row.league ? { league: row.league } : {}),
      ...(row.startTime ? { startTime: row.startTime } : {}),
    };
  }
}
