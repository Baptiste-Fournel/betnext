import { IngestUpcomingMatches } from './IngestUpcomingMatches';
import { IngestMatchMarket } from './IngestMatchMarket';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';
import {
  EsportsSchedule,
  EsportsScheduleProvider,
  ScheduledMatch,
} from './ports/EsportsScheduleProvider';
import {
  CreatedMarket,
  MarketCreationPort,
  MarketCreationRequest,
} from '../../../shared-kernel/ports/MarketCreationPort';

const recordingStore = (): MatchLinkStore & { saved: MatchLink[] } => {
  const saved: MatchLink[] = [];
  return {
    saved,
    save: async (link) => {
      saved.push(link);
    },
    find: async (matchId) => saved.find((l) => l.matchId === matchId) ?? null,
    list: async () => saved,
  };
};

// Reproduit le contrat du catalog (un id d'issue par label, dans l'ordre) — comme IngestMatchMarket.spec.
const recordingMarkets = (): MarketCreationPort & { calls: MarketCreationRequest[] } => {
  const calls: MarketCreationRequest[] = [];
  let seq = 0;
  return {
    calls,
    createMarket: async (req) => {
      seq += 1;
      const created: CreatedMarket = {
        id: `mkt-${seq}`,
        name: req.name,
        game: req.game,
        outcomes: req.outcomeLabels.map((label, index) => ({
          id: `mkt-${seq}-${index + 1}`,
          label,
        })),
      };
      calls.push(req);
      return created;
    },
  };
};

const scheduleOf = (
  source: EsportsSchedule['source'],
  matches: ScheduledMatch[],
): EsportsScheduleProvider => ({
  fetchUpcoming: async () => ({ source, matches }),
});

const T1_VS_TL: ScheduledMatch = {
  externalId: '115570934355614497',
  game: 'LoL',
  league: 'MSI',
  teamA: 'T1',
  teamB: 'Team Liquid',
  startTime: '2026-06-28T03:00:00Z',
};
const KC_VS_DCG: ScheduledMatch = {
  externalId: '115570934355614503',
  game: 'LoL',
  league: 'MSI',
  teamA: 'Karmine Corp',
  teamB: 'DCG',
  startTime: '2026-06-28T08:00:00Z',
};

describe('IngestUpcomingMatches (BET-30)', () => {
  it('shouldCreateOneBettableMarketPerUpcomingMatch_WhenIngestingLiveSchedule', async () => {
    // Arrange
    const markets = recordingMarkets();
    const store = recordingStore();
    const ingest = new IngestUpcomingMatches(
      scheduleOf('live', [T1_VS_TL, KC_VS_DCG]),
      new IngestMatchMarket(markets, store),
      store,
    );

    // Act
    const summary = await ingest.execute();

    // Assert — un marché LoL à 2 issues (Victoire A / Victoire B) par match, libellés mappés
    expect(summary).toMatchObject({ source: 'live', total: 2, ingested: 2, skipped: 0, failed: 0 });
    expect(markets.calls).toEqual([
      {
        name: 'T1 vs Team Liquid',
        game: 'LoL',
        outcomeLabels: ['Victoire T1', 'Victoire Team Liquid'],
      },
      {
        name: 'Karmine Corp vs DCG',
        game: 'LoL',
        outcomeLabels: ['Victoire Karmine Corp', 'Victoire DCG'],
      },
    ]);
    // le lien porte l'externalId comme clé + le mapping côté→issue (pour le règlement) + ligue + kickoff
    expect(store.saved[0]).toEqual({
      matchId: '115570934355614497',
      marketId: 'mkt-1',
      outcomes: ['mkt-1-1', 'mkt-1-2'],
      mapping: { HOME: 'mkt-1-1', AWAY: 'mkt-1-2' },
      league: 'MSI',
      startTime: '2026-06-28T03:00:00Z',
    });
  });

  it('shouldSkipAlreadyIngestedMatchesAndCreateNoNewMarket_WhenReingestingSameSchedule', async () => {
    // Arrange — même planning ingéré deux fois
    const markets = recordingMarkets();
    const store = recordingStore();
    const ingest = new IngestUpcomingMatches(
      scheduleOf('live', [T1_VS_TL, KC_VS_DCG]),
      new IngestMatchMarket(markets, store),
      store,
    );

    // Act
    await ingest.execute();
    const second = await ingest.execute();

    // Assert — idempotent : aucun marché dupliqué au second passage
    expect(second).toMatchObject({ total: 2, ingested: 0, skipped: 2 });
    expect(markets.calls).toHaveLength(2);
    expect(store.saved).toHaveLength(2);
  });

  it('shouldDegradeWithoutCreatingMarketsAndKeepExistingIntact_WhenFeedThrows', async () => {
    // Arrange — feed totalement injoignable (même le fallback échoue)
    const markets = recordingMarkets();
    const store = recordingStore();
    await store.save({
      matchId: 'existing',
      marketId: 'mkt-existing',
      outcomes: ['o1', 'o2'],
      mapping: { HOME: 'o1', AWAY: 'o2' },
    });
    const throwingProvider: EsportsScheduleProvider = {
      fetchUpcoming: async () => {
        throw new Error('esports down');
      },
    };
    const ingest = new IngestUpcomingMatches(
      throwingProvider,
      new IngestMatchMarket(markets, store),
      store,
    );

    // Act
    const summary = await ingest.execute();

    // Assert — l'app ne casse pas : aucun marché créé, le lien existant est intact
    expect(summary).toMatchObject({ total: 0, ingested: 0, skipped: 0, failed: 0 });
    expect(markets.calls).toHaveLength(0);
    expect(store.saved).toEqual([
      {
        matchId: 'existing',
        marketId: 'mkt-existing',
        outcomes: ['o1', 'o2'],
        mapping: { HOME: 'o1', AWAY: 'o2' },
      },
    ]);
  });

  it('shouldReportFixturesSource_WhenProviderFallsBackToFixtures', async () => {
    // Arrange
    const store = recordingStore();
    const ingest = new IngestUpcomingMatches(
      scheduleOf('fixtures', [T1_VS_TL]),
      new IngestMatchMarket(recordingMarkets(), store),
      store,
    );

    // Act
    const summary = await ingest.execute();

    // Assert — le mode dégradé est signalé à l'appelant
    expect(summary.source).toBe('fixtures');
    expect(summary.ingested).toBe(1);
  });

  it('shouldCountFailureAndKeepIngestingOthers_WhenOneMatchIsMalformed', async () => {
    // Arrange — un match sans externalId fait échouer l'ingestion mais ne stoppe pas le reste
    const markets = recordingMarkets();
    const store = recordingStore();
    const malformed: ScheduledMatch = { ...T1_VS_TL, externalId: '   ' };
    const ingest = new IngestUpcomingMatches(
      scheduleOf('live', [malformed, KC_VS_DCG]),
      new IngestMatchMarket(markets, store),
      store,
    );

    // Act
    const summary = await ingest.execute();

    // Assert
    expect(summary).toMatchObject({ total: 2, ingested: 1, failed: 1 });
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0].matchId).toBe('115570934355614503');
  });
});
