import { FeatureRiotMatch } from './FeatureRiotMatch';
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

// Crée un marché dont les ids d'issues sont déterministes et alignés sur l'ordre des labels,
// ce qui reproduit le contrat de InMemoryMarketCatalog / TypeOrmMarketCatalog (id par index).
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

describe('FeatureRiotMatch (BET-29)', () => {
  it('shouldCreateMarketAndLinkWithSideMappedByIndex_WhenFeaturingThreeWayMatch', async () => {
    // Arrange
    const markets = recordingMarkets();
    const store = recordingStore();

    // Act
    const featured = await new FeatureRiotMatch(markets, store).execute({
      name: 'G2 vs FNC',
      game: 'LoL',
      matchId: 'EUW1_7437325115',
      region: 'EUW',
      outcomes: [
        { label: 'Victoire G2', side: 'HOME' },
        { label: 'Victoire FNC', side: 'AWAY' },
        { label: 'Match nul', side: 'DRAW' },
      ],
    });

    // Assert — le marché est créé avec les libellés dans l'ordre fourni
    expect(markets.calls).toEqual([
      { name: 'G2 vs FNC', game: 'LoL', outcomeLabels: ['Victoire G2', 'Victoire FNC', 'Match nul'] },
    ]);
    // mapping côté → id d'issue généré, aligné par index
    expect(featured.mapping).toEqual({
      HOME: 'mkt-generated-1',
      AWAY: 'mkt-generated-2',
      DRAW: 'mkt-generated-3',
    });
    expect(featured.marketId).toBe('mkt-generated');
    expect(featured.region).toBe('EUW');
    expect(featured.outcomes).toEqual(['mkt-generated-1', 'mkt-generated-2', 'mkt-generated-3']);
    // le lien enregistré est cohérent avec ce que SyncMatchResult attend
    expect(store.saved).toEqual([
      {
        matchId: 'EUW1_7437325115',
        outcomes: ['mkt-generated-1', 'mkt-generated-2', 'mkt-generated-3'],
        mapping: { HOME: 'mkt-generated-1', AWAY: 'mkt-generated-2', DRAW: 'mkt-generated-3' },
        marketId: 'mkt-generated',
        region: 'EUW',
      },
    ]);
  });

  it('shouldLinkWithoutRegion_WhenRegionOmitted', async () => {
    // Arrange
    const store = recordingStore();

    // Act
    const featured = await new FeatureRiotMatch(recordingMarkets(), store).execute({
      name: 'NaVi vs Vitality',
      game: 'CS2',
      matchId: 'EUW1_999',
      outcomes: [
        { label: 'Victoire NaVi', side: 'HOME' },
        { label: 'Victoire Vitality', side: 'AWAY' },
      ],
    });

    // Assert
    expect(featured.region).toBeNull();
    expect(store.saved[0].region).toBeUndefined();
  });

  it('shouldRejectAndNotCreateMarket_WhenMatchIdMissing', async () => {
    // Arrange
    const markets = recordingMarkets();
    const store = recordingStore();

    // Act / Assert — aucun marché ne doit être créé si le lien ne peut pas être formé
    await expect(
      new FeatureRiotMatch(markets, store).execute({
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

  it('shouldRejectAndNotCreateMarket_WhenFewerThanTwoOutcomes', async () => {
    // Arrange
    const markets = recordingMarkets();

    // Act / Assert
    await expect(
      new FeatureRiotMatch(markets, recordingStore()).execute({
        name: 'x',
        game: 'LoL',
        matchId: 'EUW1_1',
        outcomes: [{ label: 'A', side: 'HOME' }],
      }),
    ).rejects.toThrow();
    expect(markets.calls).toHaveLength(0);
  });

  it('shouldRejectAndNotCreateMarket_WhenSideInvalid', async () => {
    // Arrange
    const markets = recordingMarkets();

    // Act / Assert
    await expect(
      new FeatureRiotMatch(markets, recordingStore()).execute({
        name: 'x',
        game: 'LoL',
        matchId: 'EUW1_1',
        outcomes: [
          { label: 'A', side: 'HOME' },
          { label: 'B', side: 'SIDE_C' as never },
        ],
      }),
    ).rejects.toThrow();
    expect(markets.calls).toHaveLength(0);
  });

  it('shouldRejectAndNotCreateMarket_WhenSameSideUsedTwice', async () => {
    // Arrange
    const markets = recordingMarkets();

    // Act / Assert
    await expect(
      new FeatureRiotMatch(markets, recordingStore()).execute({
        name: 'x',
        game: 'LoL',
        matchId: 'EUW1_1',
        outcomes: [
          { label: 'A', side: 'HOME' },
          { label: 'B', side: 'HOME' },
        ],
      }),
    ).rejects.toThrow();
    expect(markets.calls).toHaveLength(0);
  });
});
