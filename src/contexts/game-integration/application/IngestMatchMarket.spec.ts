import { IngestMatchMarket } from './IngestMatchMarket';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';
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

// Reproduit le contrat du catalog (un id d'issue par label, dans l'ordre).
const recordingMarkets = (): MarketCreationPort & { calls: MarketCreationRequest[] } => {
  const calls: MarketCreationRequest[] = [];
  return {
    calls,
    createMarket: async (req) => {
      calls.push(req);
      const created: CreatedMarket = {
        id: 'mkt-generated',
        name: req.name,
        game: req.game,
        outcomes: req.outcomeLabels.map((label, index) => ({
          id: `mkt-generated-${index + 1}`,
          label,
        })),
      };
      return created;
    },
  };
};

describe('IngestMatchMarket (BET-30)', () => {
  it('shouldCreateMarketAndLinkWithSideMappingLeagueAndKickoff_WhenIngestingUpcomingMatch', async () => {
    // Arrange
    const markets = recordingMarkets();
    const store = recordingStore();

    // Act
    const result = await new IngestMatchMarket(markets, store).execute({
      name: 'G2 Esports vs Fnatic',
      game: 'LoL',
      matchId: '115570934355614497',
      league: 'LEC',
      startTime: '2026-06-28T03:00:00Z',
      outcomes: [
        { label: 'Victoire G2 Esports', side: 'HOME' },
        { label: 'Victoire Fnatic', side: 'AWAY' },
      ],
    });

    // Assert — le marché est créé avec les libellés dans l'ordre fourni
    expect(markets.calls).toEqual([
      {
        name: 'G2 Esports vs Fnatic',
        game: 'LoL',
        outcomeLabels: ['Victoire G2 Esports', 'Victoire Fnatic'],
      },
    ]);
    // le mapping côté→issue est aligné par index (consommé par le moteur de règlement)
    expect(result.mapping).toEqual({ HOME: 'mkt-generated-1', AWAY: 'mkt-generated-2' });
    expect(result.marketId).toBe('mkt-generated');
    expect(result.league).toBe('LEC');
    expect(result.startTime).toBe('2026-06-28T03:00:00Z');
    expect(result.outcomes).toEqual(['mkt-generated-1', 'mkt-generated-2']);
    // le lien enregistré est cohérent avec ce que SyncMatchResult attend
    expect(store.saved).toEqual([
      {
        matchId: '115570934355614497',
        outcomes: ['mkt-generated-1', 'mkt-generated-2'],
        mapping: { HOME: 'mkt-generated-1', AWAY: 'mkt-generated-2' },
        marketId: 'mkt-generated',
        league: 'LEC',
        startTime: '2026-06-28T03:00:00Z',
      },
    ]);
  });

  it('shouldLinkWithoutLeagueAndStartTime_WhenOmitted', async () => {
    // Arrange
    const store = recordingStore();

    // Act
    const result = await new IngestMatchMarket(recordingMarkets(), store).execute({
      name: 'NaVi vs Vitality',
      game: 'CS2',
      matchId: 'evt-999',
      outcomes: [
        { label: 'Victoire NaVi', side: 'HOME' },
        { label: 'Victoire Vitality', side: 'AWAY' },
      ],
    });

    // Assert
    expect(result.league).toBeNull();
    expect(result.startTime).toBeNull();
    expect(store.saved[0].league).toBeUndefined();
    expect(store.saved[0].startTime).toBeUndefined();
  });

  it('shouldRejectAndNotCreateMarket_WhenMatchIdMissing', async () => {
    // Arrange
    const markets = recordingMarkets();
    const store = recordingStore();

    // Act / Assert — aucun marché ne doit être créé si le lien ne peut pas être formé
    await expect(
      new IngestMatchMarket(markets, store).execute({
        name: 'x',
        game: 'LoL',
        matchId: '   ',
        outcomes: [
          { label: 'A', side: 'HOME' },
          { label: 'B', side: 'AWAY' },
        ],
      }),
    ).rejects.toThrow();
    expect(markets.calls).toHaveLength(0);
    expect(store.saved).toHaveLength(0);
  });

  it('shouldRejectAndNotCreateMarket_WhenSameSideUsedTwice', async () => {
    // Arrange
    const markets = recordingMarkets();

    // Act / Assert
    await expect(
      new IngestMatchMarket(markets, recordingStore()).execute({
        name: 'x',
        game: 'LoL',
        matchId: 'evt-1',
        outcomes: [
          { label: 'A', side: 'HOME' },
          { label: 'B', side: 'HOME' },
        ],
      }),
    ).rejects.toThrow();
    expect(markets.calls).toHaveLength(0);
  });
});
