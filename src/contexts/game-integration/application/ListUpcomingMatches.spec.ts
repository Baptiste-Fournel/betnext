import { ListUpcomingMatches } from './ListUpcomingMatches';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';

const store = (links: MatchLink[]): MatchLinkStore => ({
  save: async () => undefined,
  find: async (matchId) => links.find((l) => l.matchId === matchId) ?? null,
  list: async () => links,
});

describe('ListUpcomingMatches (BET-30)', () => {
  it('shouldExposeMarketLeagueAndKickoff_WhenLinksArePresent', async () => {
    // Arrange — un match à venir ingéré porte ligue + kickoff
    const upcoming: MatchLink = {
      matchId: '115570934355614497',
      marketId: 'mkt-msi',
      outcomes: ['mkt-msi-1', 'mkt-msi-2'],
      mapping: { HOME: 'mkt-msi-1', AWAY: 'mkt-msi-2' },
      league: 'MSI',
      startTime: '2026-06-28T03:00:00Z',
    };

    // Act
    const [result] = await new ListUpcomingMatches(store([upcoming])).execute();

    // Assert
    expect(result).toEqual({
      matchId: '115570934355614497',
      marketId: 'mkt-msi',
      league: 'MSI',
      startTime: '2026-06-28T03:00:00Z',
    });
  });

  it('shouldExposeNullLeagueAndStartTime_WhenAbsent', async () => {
    // Arrange
    const link: MatchLink = {
      matchId: 'evt-1',
      marketId: 'mkt-1',
      outcomes: ['mkt-1-1', 'mkt-1-2'],
      mapping: { HOME: 'mkt-1-1', AWAY: 'mkt-1-2' },
    };

    // Act
    const [result] = await new ListUpcomingMatches(store([link])).execute();

    // Assert
    expect(result.league).toBeNull();
    expect(result.startTime).toBeNull();
  });

  it('shouldReturnEmptyList_WhenNoUpcomingMatch', async () => {
    // Act
    const result = await new ListUpcomingMatches(store([])).execute();

    // Assert
    expect(result).toEqual([]);
  });
});
