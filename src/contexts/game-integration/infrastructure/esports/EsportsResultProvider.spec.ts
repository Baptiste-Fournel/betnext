import { EsportsResultProvider } from './EsportsResultProvider';

const eventDetails = (teams: Array<{ code?: string; gameWins: number }>, count = 5): unknown => ({
  data: {
    event: {
      id: 'evt',
      league: { name: 'LEC' },
      match: {
        strategy: { type: 'bestOf', count },
        teams: teams.map((t) => ({
          code: t.code ?? 'XX',
          image: 'http://x/logo.png',
          result: { gameWins: t.gameWins, outcome: t.gameWins >= 3 ? 'win' : 'loss' },
        })),
      },
    },
  },
});

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

describe('EsportsResultProvider — LoL Esports results ACL → domain (BET-32)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shouldReportHomeWinner_WhenFirstTeamReachedRequiredWins', async () => {
    // Arrange
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(fetchReturning(eventDetails([{ gameWins: 3 }, { gameWins: 1 }], 5)));
    const provider = new EsportsResultProvider('https://esports-api.example', 'public-key');

    // Act
    const report = await provider.fetchMatchReport('116634566264113564');

    // Assert
    expect(report).toEqual({ matchId: '116634566264113564', status: 'FINISHED', winner: 'HOME' });
  });

  it('shouldReportAwayWinner_WhenSecondTeamReachedRequiredWins', async () => {
    // Arrange
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(fetchReturning(eventDetails([{ gameWins: 0 }, { gameWins: 3 }], 5)));
    const provider = new EsportsResultProvider('https://esports-api.example', 'k');

    // Act
    const report = await provider.fetchMatchReport('m');

    // Assert
    expect(report.status).toBe('FINISHED');
    expect(report.winner).toBe('AWAY');
  });

  it('shouldReportPending_WhenNoTeamReachedRequiredWins', async () => {
    // Arrange
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(fetchReturning(eventDetails([{ gameWins: 2 }, { gameWins: 1 }], 5)));
    const provider = new EsportsResultProvider('https://esports-api.example', 'k');

    // Act
    const report = await provider.fetchMatchReport('m');

    // Assert
    expect(report).toEqual({ matchId: 'm', status: 'PENDING', winner: null });
  });

  it('shouldReportPending_WhenMatchNotFound', async () => {
    // Arrange
    jest.spyOn(global, 'fetch').mockImplementation(fetchReturning({}, { ok: false, status: 404 }));
    const provider = new EsportsResultProvider('https://esports-api.example', 'k');

    // Act
    const report = await provider.fetchMatchReport('unknown');

    // Assert
    expect(report.status).toBe('PENDING');
  });

  it('shouldThrowAndNotSettle_WhenHttpError', async () => {
    // Arrange
    jest.spyOn(global, 'fetch').mockImplementation(fetchReturning({}, { ok: false, status: 503 }));
    const provider = new EsportsResultProvider('https://esports-api.example', 'k');

    // Act / Assert
    await expect(provider.fetchMatchReport('m')).rejects.toThrow(/503/);
  });

  it('shouldReturnPendingAndNotGuess_WhenTeamsShapeUnexpected', async () => {
    // Arrange
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(fetchReturning(eventDetails([{ gameWins: 3 }], 5)));
    const provider = new EsportsResultProvider('https://esports-api.example', 'k');

    // Act
    const report = await provider.fetchMatchReport('m');

    // Assert
    expect(report.status).toBe('PENDING');
  });

  it('shouldSendApiKeyHeaderAndCallEventDetailsById_WhenFetching', async () => {
    // Arrange
    const spy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(fetchReturning(eventDetails([{ gameWins: 3 }, { gameWins: 0 }], 5)));
    const provider = new EsportsResultProvider('https://esports-api.example', 'public-key');

    // Act
    await provider.fetchMatchReport('match-42');

    // Assert
    const [url, options] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/persisted/gw/getEventDetails');
    expect(url).toContain('id=match-42');
    expect(url).not.toContain('public-key');
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('public-key');
  });
});
