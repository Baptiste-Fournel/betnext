import { FallbackEsportsScheduleProvider } from './FallbackEsportsScheduleProvider';
import { FixtureEsportsScheduleProvider } from './FixtureEsportsScheduleProvider';
import {
  EsportsSchedule,
  EsportsScheduleProvider,
} from '../../application/ports/EsportsScheduleProvider';

const liveSchedule: EsportsSchedule = {
  source: 'live',
  matches: [
    {
      externalId: 'live-1',
      game: 'LoL',
      league: 'MSI',
      teamA: 'T1',
      teamB: 'Gen.G',
      startTime: '2026-06-28T03:00:00Z',
    },
  ],
};

describe('FallbackEsportsScheduleProvider (BET-30)', () => {
  it('shouldReturnLiveMatches_WhenPrimarySucceeds', async () => {
    // Arrange
    const primary: EsportsScheduleProvider = { fetchUpcoming: async () => liveSchedule };
    const provider = new FallbackEsportsScheduleProvider(
      primary,
      new FixtureEsportsScheduleProvider(),
    );

    // Act
    const schedule = await provider.fetchUpcoming();

    // Assert
    expect(schedule.source).toBe('live');
    expect(schedule.matches).toEqual(liveSchedule.matches);
  });

  it('shouldFallBackToFixturesAndSignalDegraded_WhenPrimaryThrows', async () => {
    // Arrange
    const primary: EsportsScheduleProvider = {
      fetchUpcoming: async () => {
        throw new Error('esports down');
      },
    };
    const provider = new FallbackEsportsScheduleProvider(
      primary,
      new FixtureEsportsScheduleProvider(() => Date.parse('2026-06-17T00:00:00Z')),
    );

    // Act
    const schedule = await provider.fetchUpcoming();

    // Assert
    expect(schedule.source).toBe('fixtures');
    expect(schedule.matches.length).toBeGreaterThan(0);
    expect(schedule.matches[0].league).toBe('LEC');
  });
});
