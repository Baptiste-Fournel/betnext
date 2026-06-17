import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

describe('CircuitBreaker (shared, défi 3) — fail-fast sur dépendance externe en panne', () => {
  const fail = (): Promise<never> => Promise.reject(new Error('boom'));
  const ok = (): Promise<string> => Promise.resolve('ok');

  it('shouldOpenCircuitAndShortCircuit_WhenConsecutiveFailuresExceedThreshold', async () => {
    // Arrange
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000, now: () => 0 });

    // Act
    for (let i = 0; i < 3; i++) {
      await expect(cb.call(fail)).rejects.toThrow('boom');
    }

    // Assert
    expect(cb.currentState).toBe('OPEN');

    let called = false;
    await expect(
      cb.call(async () => {
        called = true;
        return 'x';
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);
  });

  it('shouldTransitionToHalfOpenThenCloseOnSuccess_WhenResetTimeoutElapsed', async () => {
    // Arrange
    let t = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, now: () => t });

    // Act / Assert
    await expect(cb.call(fail)).rejects.toThrow();
    expect(cb.currentState).toBe('OPEN');

    t = 500;
    await expect(cb.call(ok)).rejects.toBeInstanceOf(CircuitOpenError);

    t = 1000;
    await expect(cb.call(ok)).resolves.toBe('ok');
    expect(cb.currentState).toBe('CLOSED');
  });

  it('shouldReopenImmediately_WhenFailureInHalfOpen', async () => {
    // Arrange
    let t = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100, now: () => t });

    // Act / Assert
    await expect(cb.call(fail)).rejects.toThrow();
    t = 100;
    await expect(cb.call(fail)).rejects.toThrow('boom');
    expect(cb.currentState).toBe('OPEN');
  });
});
