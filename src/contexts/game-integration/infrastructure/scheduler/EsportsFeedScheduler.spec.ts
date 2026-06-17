import { EsportsFeedScheduler, FeedIngestor, FeedResultsSync } from './EsportsFeedScheduler';

const recorder = (): {
  calls: string[];
  ingest: FeedIngestor;
  results: FeedResultsSync;
} => {
  const calls: string[] = [];
  return {
    calls,
    ingest: {
      execute: async () => {
        calls.push('ingest');
      },
    },
    results: {
      execute: async () => {
        calls.push('results');
      },
    },
  };
};

describe('EsportsFeedScheduler (BET-33)', () => {
  it('shouldTriggerIngestionThenResultsSync_WhenRunOnce', async () => {
    // Arrange
    const r = recorder();
    const scheduler = new EsportsFeedScheduler(r.ingest, r.results, {
      enabled: true,
      intervalMs: 1000,
    });

    // Act
    await scheduler.runOnce();

    // Assert
    expect(r.calls).toEqual(['ingest', 'results']);
  });

  it('shouldNotScheduleNorCallUseCases_WhenDisabled', () => {
    // Arrange
    const r = recorder();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const scheduler = new EsportsFeedScheduler(r.ingest, r.results, {
      enabled: false,
      intervalMs: 1000,
    });

    // Act
    scheduler.onApplicationBootstrap();

    // Assert
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(r.calls).toEqual([]);
    setIntervalSpy.mockRestore();
  });

  it('shouldIsolateIngestionFailureAndStillSyncResults_WhenIngestThrows', async () => {
    // Arrange
    const calls: string[] = [];
    const ingest: FeedIngestor = {
      execute: async () => {
        throw new Error('feed down');
      },
    };
    const results: FeedResultsSync = {
      execute: async () => {
        calls.push('results');
      },
    };
    const scheduler = new EsportsFeedScheduler(ingest, results, {
      enabled: true,
      intervalMs: 1000,
    });

    // Act
    await expect(scheduler.runOnce()).resolves.toBeUndefined();

    // Assert
    expect(calls).toEqual(['results']);
  });

  it('shouldKeepRunningAfterFailingRun_WhenNextTickFires', async () => {
    // Arrange
    let attempt = 0;
    const calls: string[] = [];
    const ingest: FeedIngestor = {
      execute: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('transient');
        }
        calls.push('ingest');
      },
    };
    const results: FeedResultsSync = {
      execute: async () => {
        calls.push('results');
      },
    };
    const scheduler = new EsportsFeedScheduler(ingest, results, {
      enabled: true,
      intervalMs: 1000,
    });

    // Act
    await scheduler.runOnce();
    await scheduler.runOnce();

    // Assert
    expect(calls).toEqual(['results', 'ingest', 'results']);
  });

  it('shouldNotRunConcurrently_WhenPreviousRunStillInFlight', async () => {
    // Arrange
    let release: () => void = () => undefined;
    let ingestCalls = 0;
    const ingest: FeedIngestor = {
      execute: () =>
        new Promise<void>((resolve) => {
          ingestCalls += 1;
          release = resolve;
        }),
    };
    const results: FeedResultsSync = { execute: async () => undefined };
    const scheduler = new EsportsFeedScheduler(ingest, results, {
      enabled: true,
      intervalMs: 1000,
    });

    // Act
    const first = scheduler.runOnce();
    const second = scheduler.runOnce();
    await second;

    // Assert
    expect(ingestCalls).toBe(1);

    release();
    await first;
    expect(ingestCalls).toBe(1);
  });

  it('shouldStartIntervalAndStopOnDestroy_WhenEnabled', async () => {
    // Arrange
    jest.useFakeTimers();
    try {
      const r = recorder();
      const scheduler = new EsportsFeedScheduler(r.ingest, r.results, {
        enabled: true,
        intervalMs: 1000,
      });

      // Act
      scheduler.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(1000);
      expect(r.calls).toEqual(['ingest', 'results']);

      await jest.advanceTimersByTimeAsync(1000);
      expect(r.calls).toEqual(['ingest', 'results', 'ingest', 'results']);

      // Act
      await scheduler.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(5000);

      // Assert
      expect(r.calls).toEqual(['ingest', 'results', 'ingest', 'results']);
    } finally {
      jest.useRealTimers();
    }
  });
});
