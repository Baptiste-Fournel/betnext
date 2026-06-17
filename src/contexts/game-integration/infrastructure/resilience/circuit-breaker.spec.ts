import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

describe('CircuitBreaker (BET-21, défi 3)', () => {
  const fail = (): Promise<never> => Promise.reject(new Error('boom'));
  const ok = (): Promise<string> => Promise.resolve('ok');

  it('ouvre après N échecs consécutifs et court-circuite (fail-fast, dépendance NON appelée)', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000, now: () => 0 });
    for (let i = 0; i < 3; i++) {
      await expect(cb.call(fail)).rejects.toThrow('boom');
    }
    expect(cb.currentState).toBe('OPEN');

    let called = false;
    await expect(
      cb.call(async () => {
        called = true;
        return 'x';
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false); // OPEN → la dépendance n'est PAS appelée
  });

  it('après le délai de reset : HALF_OPEN puis succès → referme (CLOSED)', async () => {
    let t = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 1000, now: () => t });
    await expect(cb.call(fail)).rejects.toThrow(); // → OPEN
    expect(cb.currentState).toBe('OPEN');

    t = 500;
    await expect(cb.call(ok)).rejects.toBeInstanceOf(CircuitOpenError); // pas encore l'heure

    t = 1000;
    await expect(cb.call(ok)).resolves.toBe('ok'); // HALF_OPEN → succès → CLOSED
    expect(cb.currentState).toBe('CLOSED');
  });

  it('un échec en HALF_OPEN ré-ouvre immédiatement', async () => {
    let t = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 100, now: () => t });
    await expect(cb.call(fail)).rejects.toThrow(); // OPEN
    t = 100;
    await expect(cb.call(fail)).rejects.toThrow('boom'); // HALF_OPEN → échec → OPEN
    expect(cb.currentState).toBe('OPEN');
  });
});
