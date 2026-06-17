import { TimeoutError, withTimeout } from './with-timeout';

describe('withTimeout (shared, défi 3)', () => {
  it('shouldResolve_WhenFunctionRespondsInTime', async () => {
    // Act / Assert
    await expect(withTimeout(() => Promise.resolve(42), 50)).resolves.toBe(42);
  });

  it('shouldRejectWithTimeoutError_WhenFunctionTooSlow', async () => {
    // Arrange
    const slow = (): Promise<number> => new Promise((resolve) => setTimeout(() => resolve(1), 100));

    // Act / Assert
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError);
  });
});
