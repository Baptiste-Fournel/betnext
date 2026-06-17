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

// Transforme les matchs pro à venir (port ACL) en marchés bettables, via la brique
// IngestMatchMarket (→ MarketCreationPort + lien match↔marché). Les cotes restent calculées
// par NOTRE pricing ; aucune cote externe n'entre ici. Idempotent : un externalId déjà lié est
// ignoré → un re-pull ne duplique pas les marchés.
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
      // Feed totalement injoignable : on dégrade sans jamais casser l'app. Aucun marché créé,
      // l'existant reste intact. Le mode dégradé est signalé via `source: 'fixtures'`.
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
        // Un match mal formé (id vide, libellés manquants…) ne doit jamais interrompre
        // l'ingestion des autres ni laisser l'app dans un état cassé.
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
      // LoL = pas de match nul : 2 issues, HOME = équipe A, AWAY = équipe B. Le mapping
      // côté→issue est posé sur le lien pour le règlement-par-résultat (futur driver auto).
      outcomes: [
        { label: `Victoire ${match.teamA}`, side: 'HOME' },
        { label: `Victoire ${match.teamB}`, side: 'AWAY' },
      ],
    };
  }
}
