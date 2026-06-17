import { TimeoutError, withTimeout } from './with-timeout';

describe('withTimeout (BET-21, défi 3)', () => {
  it('résout si la fonction répond à temps', async () => {
    await expect(withTimeout(() => Promise.resolve(42), 50)).resolves.toBe(42);
  });

  it('rejette avec TimeoutError si la fonction est trop lente', async () => {
    const slow = (): Promise<number> => new Promise((resolve) => setTimeout(() => resolve(1), 100));
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError);
  });
});
