import { IngestMatchMarket, IngestMatchMarketInput } from './IngestMatchMarket';
import {
  EsportsSchedule,
  EsportsScheduleProvider,
  ScheduledMatch,
  ScheduleSource,
} from './ports/EsportsScheduleProvider';
import { MatchLinkStore } from './ports/MatchLinkStore';

export interface IngestSummary {
  source: ScheduleSource;
  total: number;
  ingested: number;
  skipped: number;
  failed: number;
  marketIds: string[];
}

export class IngestUpcomingMatches {
  constructor(
    private readonly schedule: EsportsScheduleProvider,
    private readonly ingestMatch: IngestMatchMarket,
    private readonly links: MatchLinkStore,
  ) {}

  async execute(): Promise<IngestSummary> {
    let schedule: EsportsSchedule;
    try {
      schedule = await this.schedule.fetchUpcoming();
    } catch {
      return { source: 'fixtures', total: 0, ingested: 0, skipped: 0, failed: 0, marketIds: [] };
    }

    const summary: IngestSummary = {
      source: schedule.source,
      total: schedule.matches.length,
      ingested: 0,
      skipped: 0,
      failed: 0,
      marketIds: [],
    };

    for (const match of schedule.matches) {
      try {
        if (await this.links.find(match.externalId)) {
          summary.skipped += 1;
          continue;
        }
        const created = await this.ingestMatch.execute(this.toIngestInput(match));
        summary.ingested += 1;
        summary.marketIds.push(created.marketId);
      } catch {
        summary.failed += 1;
      }
    }

    return summary;
  }

  private toIngestInput(match: ScheduledMatch): IngestMatchMarketInput {
    return {
      name: `${match.teamA} vs ${match.teamB}`,
      game: match.game,
      matchId: match.externalId,
      league: match.league,
      startTime: match.startTime,
      outcomes: [
        { label: `Victoire ${match.teamA}`, side: 'HOME' },
        { label: `Victoire ${match.teamB}`, side: 'AWAY' },
      ],
    };
  }
}
