import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { MarketCreationPort } from '../../../shared-kernel/ports/MarketCreationPort';
import { MatchOutcomeSide } from '../domain/MatchReport';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';

export interface IngestOutcomeInput {
  label: string;
  side: MatchOutcomeSide;
}

export interface IngestMatchMarketInput {
  name: string;
  game: string;
  matchId: string;
  region?: string;
  league?: string;
  startTime?: string;
  outcomes: IngestOutcomeInput[];
}

export interface MatchMarket {
  matchId: string;
  marketId: string;
  region: string | null;
  league: string | null;
  startTime: string | null;
  outcomes: string[];
  mapping: Partial<Record<MatchOutcomeSide, string>>;
}

const SIDES: readonly MatchOutcomeSide[] = ['HOME', 'AWAY', 'DRAW'];

export class IngestMatchMarket {
  constructor(
    private readonly markets: MarketCreationPort,
    private readonly links: MatchLinkStore,
  ) {}

  async execute(input: IngestMatchMarketInput): Promise<MatchMarket> {
    const matchId = input.matchId?.trim();
    if (!matchId) {
      throw new DomainError('matchId requis');
    }
    const outcomes = input.outcomes ?? [];
    if (outcomes.length < 2) {
      throw new DomainError('au moins 2 issues requises');
    }
    const seenSides = new Set<MatchOutcomeSide>();
    for (const outcome of outcomes) {
      if (!SIDES.includes(outcome.side)) {
        throw new DomainError(`côté invalide : ${String(outcome.side)}`);
      }
      if (seenSides.has(outcome.side)) {
        throw new DomainError(`côté en double : ${outcome.side}`);
      }
      seenSides.add(outcome.side);
      if (!outcome.label?.trim()) {
        throw new DomainError("libellé d'issue requis");
      }
    }

    const market = await this.markets.createMarket({
      name: input.name,
      game: input.game,
      outcomeLabels: outcomes.map((o) => o.label.trim()),
    });
    if (market.outcomes.length !== outcomes.length) {
      throw new DomainError('incohérence entre les issues demandées et le marché créé');
    }

    const mapping: Partial<Record<MatchOutcomeSide, string>> = {};
    market.outcomes.forEach((created, index) => {
      mapping[outcomes[index].side] = created.id;
    });
    const outcomeIds = market.outcomes.map((o) => o.id);
    const region = input.region?.trim() || null;
    const league = input.league?.trim() || null;
    const startTime = input.startTime?.trim() || null;

    const link: MatchLink = {
      matchId,
      outcomes: outcomeIds,
      mapping,
      marketId: market.id,
      ...(region ? { region } : {}),
      ...(league ? { league } : {}),
      ...(startTime ? { startTime } : {}),
    };
    await this.links.save(link);

    return {
      matchId,
      marketId: market.id,
      region,
      league,
      startTime,
      outcomes: outcomeIds,
      mapping,
    };
  }
}
