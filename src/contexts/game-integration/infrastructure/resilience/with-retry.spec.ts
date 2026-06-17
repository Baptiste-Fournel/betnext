import { withRetry } from './with-retry';

const noSleep = (): Promise<void> => Promise.resolve();

describe('withRetry (BET-21, défi 3)', () => {
  it('shouldRetryThenSucceed_WhenTransientError', async () => {
    // Arrange
    let calls = 0;
    const flaky = (): Promise<string> => {
      calls += 1;
      return calls < 2 ? Promise.reject(new Error('transient')) : Promise.resolve('ok');
    };

    // Act / Assert
    await expect(withRetry(flaky, { retries: 3, baseDelayMs: 1, sleep: noSleep })).resolves.toBe(
      'ok',
    );
    expect(calls).toBe(2);
  });

  it('shouldFailAfterRetriesPlusOneAttempts_WhenAllAttemptsFail', async () => {
    // Arrange
    let calls = 0;
    const down = (): Promise<never> => {
      calls += 1;
      return Promise.reject(new Error('down'));
    };

    // Act / Assert
    await expect(withRetry(down, { retries: 2, baseDelayMs: 1, sleep: noSleep })).rejects.toThrow(
      'down',
    );
    expect(calls).toBe(3);
  });

  it('shouldNotRetryAndFailImmediately_WhenErrorIsNonRetryable', async () => {
    // Arrange
    let calls = 0;
    const deterministic = (): Promise<never> => {
      calls += 1;
      return Promise.reject(new Error('bad-request'));
    };

    // Act / Assert
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
