import { MatchLinkStore } from './ports/MatchLinkStore';
import { SyncResult } from './SyncMatchResult';

export interface MatchResultSettler {
  execute(matchId: string): Promise<SyncResult>;
}

export interface SyncResultsSummary {
  throttled: boolean;
  checked: number;
  finished: number;
  pending: number;
  failed: number;
  settledBets: number;
  won: number;
  lost: number;
  voided: number;
}

export interface SyncFeedResultsOptions {
  minIntervalMs?: number;
  now?: () => number;
}

const emptySummary = (): SyncResultsSummary => ({
  throttled: false,
  checked: 0,
  finished: 0,
  pending: 0,
  failed: 0,
  settledBets: 0,
  won: 0,
  lost: 0,
  voided: 0,
});

export class SyncFeedResults {
  private lastRunAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly links: MatchLinkStore,
    private readonly settler: MatchResultSettler,
    private readonly options: SyncFeedResultsOptions = {},
  ) {}

  async execute(): Promise<SyncResultsSummary> {
    const now = this.options.now ?? ((): number => Date.now());
    const minIntervalMs = this.options.minIntervalMs ?? 0;
    if (now() - this.lastRunAt < minIntervalMs) {
      return { ...emptySummary(), throttled: true };
    }
    this.lastRunAt = now();

    const links = await this.links.list();
    const summary = emptySummary();
    for (const link of links) {
      summary.checked += 1;
      try {
        const result = await this.settler.execute(link.matchId);
        if (result.status === 'PENDING') {
          summary.pending += 1;
          continue;
        }
        summary.finished += 1;
        if (result.summary) {
          summary.settledBets += result.summary.settled;
          summary.won += result.summary.won;
          summary.lost += result.summary.lost;
          summary.voided += result.summary.voided;
        }
      } catch {
        summary.failed += 1;
      }
    }
    return summary;
  }
}
