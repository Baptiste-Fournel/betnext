import { LolEsportsScheduleProvider } from './LolEsportsScheduleProvider';

const rawSchedule = {
  data: {
    schedule: {
      events: [
        {
          startTime: '2026-06-28T03:00:00Z',
          state: 'unstarted',
          league: { name: 'MSI', slug: 'msi' },
          match: {
            id: '115570934355614497',
            strategy: { type: 'bestOf', count: 5 },
            teams: [
              { name: 'T1', code: 'T1', image: 'http://x/t1.png' },
              { name: 'Team Liquid', code: 'TL', image: 'http://x/tl.png' },
            ],
          },
        },
        {
          startTime: '2026-06-10T10:00:00Z',
          state: 'completed',
          league: { name: 'LEC' },
          match: { id: 'done-1', teams: [{ name: 'G2' }, { name: 'FNC' }] },
        },
        {
          startTime: '2026-06-29T10:00:00Z',
          state: 'unstarted',
          league: { name: 'VCS' },
          match: { id: 'tbd-1', teams: [{ name: 'TBD' }, { name: 'Saigon Warrior' }] },
        },
      ],
    },
  },
};

const fetchReturning = (
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): typeof fetch =>
  (async () =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    }) as Response) as unknown as typeof fetch;

describe('LolEsportsScheduleProvider — ACL LoL Esports → domaine (BET-30)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shouldMapExternalScheduleToNeutralDomainMatches_WhenResponseWellFormed', async () => {
    // Arrange
    jest.spyOn(global, 'fetch').mockImplementation(fetchReturning(rawSchedule));
    const provider = new LolEsportsScheduleProvider('https://esports-api.example', 'public-key');

    // Act
    const schedule = await provider.fetchUpcoming();

    // Assert
    expect(schedule.source).toBe('live');
    expect(schedule.matches).toEqual([
      {
        externalId: '115570934355614497',
        game: 'LoL',
        league: 'MSI',
        teamA: 'T1',
        teamB: 'Team Liquid',
        startTime: '2026-06-28T03:00:00Z',
      },
    ]);
    expect(JSON.stringify(schedule.matches)).not.toMatch(/strategy|image|slug|bestOf/);
  });

  it('shouldSendApiKeyHeaderAndCallScheduleEndpoint_WhenFetchingUpcoming', async () => {
    // Arrange
    const spy = jest.spyOn(global, 'fetch').mockImplementation(fetchReturning(rawSchedule));
    const provider = new LolEsportsScheduleProvider('https://esports-api.example', 'public-key');

    // Act
    await provider.fetchUpcoming();

    // Assert
    const [url, options] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/persisted/gw/getSchedule');
    expect(url).not.toContain('public-key');
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('public-key');
  });

  it('shouldThrowAndNotReturnPartialData_WhenHttpNotOk', async () => {
    // Arrange
    jest.spyOn(global, 'fetch').mockImplementation(fetchReturning({}, { ok: false, status: 503 }));
    const provider = new LolEsportsScheduleProvider('https://esports-api.example', 'public-key');

    // Act / Assert
    await expect(provider.fetchUpcoming()).rejects.toThrow(/503/);
  });

  it('shouldCapToConfiguredLimit_WhenMoreUpcomingThanLimit', async () => {
    // Arrange
    const many = {
      data: {
        schedule: {
          events: [1, 2, 3].map((n) => ({
            startTime: `2026-07-0${n}T10:00:00Z`,
            state: 'unstarted',
            league: { name: 'LCK' },
            match: { id: `m-${n}`, teams: [{ name: `A${n}` }, { name: `B${n}` }] },
          })),
        },
      },
    };
    jest.spyOn(global, 'fetch').mockImplementation(fetchReturning(many));
    const provider = new LolEsportsScheduleProvider('https://esports-api.example', 'k', {
      limit: 2,
    });

    // Act
    const schedule = await provider.fetchUpcoming();

    // Assert
    expect(schedule.matches.map((m) => m.externalId)).toEqual(['m-1', 'm-2']);
  });
});
