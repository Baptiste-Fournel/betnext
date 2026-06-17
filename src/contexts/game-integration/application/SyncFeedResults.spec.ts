import { SyncFeedResults, MatchResultSettler } from './SyncFeedResults';
import { SyncResult } from './SyncMatchResult';
import { MatchLink, MatchLinkStore } from './ports/MatchLinkStore';

const linkStore = (matchIds: string[]): MatchLinkStore => {
  const links: MatchLink[] = matchIds.map((matchId) => ({
    matchId,
    marketId: `mkt-${matchId}`,
    outcomes: [`${matchId}-1`, `${matchId}-2`],
    mapping: { HOME: `${matchId}-1`, AWAY: `${matchId}-2` },
  }));
  return {
    save: async () => undefined,
    find: async (id) => links.find((l) => l.matchId === id) ?? null,
    list: async () => links,
  };
};

const settlerFrom = (scenarios: Record<string, SyncResult[]>): MatchResultSettler => {
  const cursors: Record<string, number> = {};
  return {
    execute: async (matchId) => {
      const queue = scenarios[matchId] ?? [{ matchId, status: 'PENDING' }];
      const i = Math.min(cursors[matchId] ?? 0, queue.length - 1);
      cursors[matchId] = (cursors[matchId] ?? 0) + 1;
      return queue[i];
    },
  };
};

const settledWon = (matchId: string, settled: number): SyncResult => ({
  matchId,
  status: 'SETTLED',
  resolution: 'WON_OUTCOME',
  winningOutcomeId: `${matchId}-1`,
  summary: { settled, won: settled, lost: 0, voided: 0, failed: 0 },
});

describe('SyncFeedResults (BET-32)', () => {
  it('shouldSettleFinishedMatchesAndLeaveUpcomingPending_WhenResultsAvailable', async () => {
    // Arrange
    const settler = settlerFrom({
      done: [settledWon('done', 1)],
      upcoming: [{ matchId: 'upcoming', status: 'PENDING' }],
    });
    const feed = new SyncFeedResults(linkStore(['done', 'upcoming']), settler);

    // Act
    const summary = await feed.execute();

    // Assert
    expect(summary).toMatchObject({
      checked: 2,
      finished: 1,
      pending: 1,
      failed: 0,
      settledBets: 1,
      won: 1,
    });
  });

  it('shouldBeNoOpOnRerun_WhenMatchAlreadySettled', async () => {
    // Arrange
    const settler = settlerFrom({
      done: [settledWon('done', 1), settledWon('done', 0)],
    });
    const feed = new SyncFeedResults(linkStore(['done']), settler);

    // Act
    const first = await feed.execute();
    const second = await feed.execute();

    // Assert
    expect(first.settledBets).toBe(1);
    expect(second.settledBets).toBe(0);
    expect(second.finished).toBe(1);
  });

  it('shouldIsolateFailureAndKeepSettlingOthers_WhenOneMatchThrows', async () => {
    // Arrange
    const settler: MatchResultSettler = {
      execute: async (matchId) => {
        if (matchId === 'boom') throw new Error('source down');
        return settledWon(matchId, 1);
      },
    };
    const feed = new SyncFeedResults(linkStore(['boom', 'ok']), settler);

    // Act
    const summary = await feed.execute();

    // Assert
    expect(summary.failed).toBe(1);
    expect(summary.finished).toBe(1);
    expect(summary.settledBets).toBe(1);
  });

  it('shouldThrottleAndSkipExternalCalls_WhenCalledWithinMinInterval', async () => {
    // Arrange
    let t = 1000;
    let calls = 0;
    const settler: MatchResultSettler = {
      execute: async (matchId) => {
        calls += 1;
        return settledWon(matchId, 1);
      },
    };
    const feed = new SyncFeedResults(linkStore(['done']), settler, {
      minIntervalMs: 5000,
      now: () => t,
    });

    // Act
    await feed.execute();
    const callsAfterFirst = calls;
    t = 2000;
    const throttled = await feed.execute();

    // Assert
    expect(throttled.throttled).toBe(true);
    expect(calls).toBe(callsAfterFirst);
  });
});
