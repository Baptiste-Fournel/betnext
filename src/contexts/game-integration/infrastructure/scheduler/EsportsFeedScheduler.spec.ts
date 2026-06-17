import { EsportsFeedScheduler, FeedIngestor, FeedResultsSync } from './EsportsFeedScheduler';

// Faux use cases qui enregistrent l'ordre des appels (zéro réseau). On ne déclenche QUE les
// use cases existants : ingestion idempotente + synchro résultats exactly-once.
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

    // Assert — ingestion d'abord, synchro résultats ensuite
    expect(r.calls).toEqual(['ingest', 'results']);
  });

  it('shouldNotScheduleNorCallUseCases_WhenDisabled', () => {
    // Arrange — désactivé (cas par défaut en test/CI : jamais d'appel à l'API externe)
    const r = recorder();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const scheduler = new EsportsFeedScheduler(r.ingest, r.results, {
      enabled: false,
      intervalMs: 1000,
    });

    // Act
    scheduler.onApplicationBootstrap();

    // Assert — aucun timer armé, aucun use case déclenché
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(r.calls).toEqual([]);
    setIntervalSpy.mockRestore();
  });

  it('shouldIsolateIngestionFailureAndStillSyncResults_WhenIngestThrows', async () => {
    // Arrange — l'ingestion échoue (feed down) ; la synchro résultats doit quand même tourner
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

    // Act — le run ne doit jamais rejeter (sinon unhandledRejection / app cassée)
    await expect(scheduler.runOnce()).resolves.toBeUndefined();

    // Assert
    expect(calls).toEqual(['results']);
  });

  it('shouldKeepRunningAfterFailingRun_WhenNextTickFires', async () => {
    // Arrange — un run KO ne doit pas bloquer les suivants
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
    await scheduler.runOnce(); // KO sur l'ingestion
    await scheduler.runOnce(); // le suivant repart normalement

    // Assert — 1er run : ingestion KO mais results OK ; 2e run : tout OK
    expect(calls).toEqual(['results', 'ingest', 'results']);
  });

  it('shouldNotRunConcurrently_WhenPreviousRunStillInFlight', async () => {
    // Arrange — un run en cours bloque tout chevauchement (anti-double déclenchement)
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

    // Act — premier run bloqué sur l'ingestion, on tente un second en parallèle
    const first = scheduler.runOnce();
    const second = scheduler.runOnce(); // doit ressortir immédiatement (run déjà en cours)
    await second;

    // Assert — le second n'a pas relancé l'ingestion
    expect(ingestCalls).toBe(1);

    // Cleanup — on débloque le premier run
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

      // Act — démarrage : un tick à chaque intervalle
      scheduler.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(1000);
      expect(r.calls).toEqual(['ingest', 'results']);

      await jest.advanceTimersByTimeAsync(1000);
      expect(r.calls).toEqual(['ingest', 'results', 'ingest', 'results']);

      // Act — arrêt propre : plus aucun tick après destroy
      await scheduler.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(5000);

      // Assert
      expect(r.calls).toEqual(['ingest', 'results', 'ingest', 'results']);
    } finally {
      jest.useRealTimers();
    }
  });
});
