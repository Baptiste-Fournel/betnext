import { ListFeaturedMatches } from './ListFeaturedMatches';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';

const store = (links: MatchLink[]): MatchLinkStore => ({
  save: async () => undefined,
  find: async (matchId) => links.find((l) => l.matchId === matchId) ?? null,
  list: async () => links,
});

describe('ListFeaturedMatches (BET-29)', () => {
  it('shouldReturnOnlyMarketBackedLinks_WhenStoreMixesFeaturedAndRawLinks', async () => {
    // Arrange — un lien featured (avec marketId) et un lien brut sans marché
    const featured: MatchLink = {
      matchId: 'EUW1_1',
      outcomes: ['o1', 'o2'],
      mapping: { HOME: 'o1', AWAY: 'o2' },
      marketId: 'mkt-1',
      region: 'EUW',
    };
    const raw: MatchLink = { matchId: 'EUW1_2', outcomes: ['x', 'y'], mapping: { HOME: 'x' } };

    // Act
    const result = await new ListFeaturedMatches(store([featured, raw])).execute();

    // Assert
    expect(result).toEqual([
      {
        matchId: 'EUW1_1',
        marketId: 'mkt-1',
        region: 'EUW',
        outcomes: ['o1', 'o2'],
        mapping: { HOME: 'o1', AWAY: 'o2' },
      },
    ]);
  });

  it('shouldReturnEmptyList_WhenNoFeaturedMatch', async () => {
    // Act
    const result = await new ListFeaturedMatches(store([])).execute();

    // Assert
    expect(result).toEqual([]);
  });

  it('shouldExposeNullRegion_WhenFeaturedWithoutRegion', async () => {
    // Arrange
    const featured: MatchLink = {
      matchId: 'EUW1_3',
      outcomes: ['o1', 'o2'],
      mapping: { HOME: 'o1', AWAY: 'o2' },
      marketId: 'mkt-3',
    };

    // Act
    const [result] = await new ListFeaturedMatches(store([featured])).execute();

    // Assert
    expect(result.region).toBeNull();
  });
});
