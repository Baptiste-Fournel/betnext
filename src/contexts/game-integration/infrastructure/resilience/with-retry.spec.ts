import { withRetry } from './with-retry';

const noSleep = (): Promise<void> => Promise.resolve();

describe('withRetry (BET-21, défi 3)', () => {
  it('réessaie une erreur transitoire puis réussit', async () => {
    let calls = 0;
    const flaky = (): Promise<string> => {
      calls += 1;
      return calls < 2 ? Promise.reject(new Error('transient')) : Promise.resolve('ok');
    };
    await expect(withRetry(flaky, { retries: 3, baseDelayMs: 1, sleep: noSleep })).resolves.toBe(
      'ok',
    );
    expect(calls).toBe(2);
  });

  it('échoue après épuisement des tentatives (essais = retries + 1)', async () => {
    let calls = 0;
    const down = (): Promise<never> => {
      calls += 1;
      return Promise.reject(new Error('down'));
    };
    await expect(withRetry(down, { retries: 2, baseDelayMs: 1, sleep: noSleep })).rejects.toThrow(
      'down',
    );
    expect(calls).toBe(3);
  });

  it('ne réessaie pas une erreur jugée non-retryable', async () => {
    let calls = 0;
    const deterministic = (): Promise<never> => {
      calls += 1;
      return Promise.reject(new Error('bad-request'));
    };
    await expect(
      withRetry(deterministic, {
        retries: 5,
        baseDelayMs: 1,
        sleep: noSleep,
        isRetryable: () => false,
      }),
    ).rejects.toThrow('bad-request');
    expect(calls).toBe(1);
  });
});
