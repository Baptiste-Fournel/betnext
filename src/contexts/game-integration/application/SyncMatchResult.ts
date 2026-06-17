import { DomainError } from '../../../shared-kernel/domain/DomainError';
import {
  MarketSettlementPort,
  SettlementSummary,
} from '../../../shared-kernel/ports/MarketSettlementPort';
import { GameProvider } from './ports/GameProvider';
import { MatchLinkStore } from './ports/MatchLinkStore';

export interface SyncResult {
  matchId: string;
  status: 'PENDING' | 'SETTLED';
  resolution?: 'WON_OUTCOME' | 'VOIDED';
  winningOutcomeId?: string;
  summary?: SettlementSummary;
}

export class SyncMatchResult {
  constructor(
    private readonly provider: GameProvider,
    private readonly links: MatchLinkStore,
    private readonly settlement: MarketSettlementPort,
  ) {}

  async execute(matchId: string): Promise<SyncResult> {
    const link = await this.links.find(matchId);
    if (!link) {
      throw new DomainError('Aucun marché lié à ce match', 404);
    }
    const report = await this.provider.fetchMatchReport(matchId);
    if (report.status !== 'FINISHED' || report.winner === null) {
      return { matchId, status: 'PENDING' };
    }
    const winningOutcomeId = link.mapping[report.winner];
    if (!winningOutcomeId) {
      const summary = await this.settlement.settle({
        outcomes: link.outcomes,
        winningOutcomeId: null,
        voided: true,
      });
      return { matchId, status: 'SETTLED', resolution: 'VOIDED', summary };
    }
    const summary = await this.settlement.settle({
      outcomes: link.outcomes,
      winningOutcomeId,
      voided: false,
    });
    return { matchId, status: 'SETTLED', resolution: 'WON_OUTCOME', winningOutcomeId, summary };
  }
}
