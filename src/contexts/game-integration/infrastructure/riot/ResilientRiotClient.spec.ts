import { ResilientRiotClient } from './ResilientRiotClient';
import { RiotClient, RiotMatchPayload } from './RiotClient';
import { CircuitBreaker, CircuitOpenError } from '../resilience/circuit-breaker';
import { TimeoutError } from '../resilience/with-timeout';

const finished: RiotMatchPayload = {
  matchId: 'm',
  finished: true,
  teams: [{ teamId: 100, win: true }],
};

/** Fake configurable : compte les appels réels à la dépendance. */
class FakeRiotClient implements RiotClient {
  calls = 0;
  constructor(private readonly behavior: (call: number) => Promise<RiotMatchPayload>) {}
  getMatch(): Promise<RiotMatchPayload> {
    this.calls += 1;
    return this.behavior(this.calls);
  }
}

describe('ResilientRiotClient (BET-21, défi 3 contre stub)', () => {
  it('shouldOpenCircuitAndShortCircuit_WhenRepeatedFailures', async () => {
    // Arrange
    const fake = new FakeRiotClient(() => Promise.reject(new Error('riot down')));
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 10_000,
      now: () => 0,
    });
    const client = new ResilientRiotClient(fake, breaker, {
      timeoutMs: 50,
      retries: 1,
      baseDelayMs: 0,
    });

    // Act / Assert
    await expect(client.getMatch('m')).rejects.toThrow('riot down');
    await expect(client.getMatch('m')).rejects.toThrow('riot down');
    expect(breaker.currentState).toBe('OPEN');

    const callsBefore = fake.calls;
    await expect(client.getMatch('m')).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fake.calls).toBe(callsBefore);
  });

  it('shouldRetryThenSucceed_WhenTransientError', async () => {
    // Arrange
    const fake = new FakeRiotClient((call) =>
      call < 2 ? Promise.reject(new Error('transient')) : Promise.resolve(finished),
    );
    const breaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 10_000,
      now: () => 0,
    });
    const client = new ResilientRiotClient(fake, breaker, {
      timeoutMs: 50,
      retries: 2,
      baseDelayMs: 0,
    });

    // Act / Assert
    await expect(client.getMatch('m')).resolves.toEqual(finished);
    expect(fake.calls).toBe(2);
    expect(breaker.currentState).toBe('CLOSED');
  });

  it('shouldRejectWithTimeoutError_WhenDependencyTooSlow', async () => {
    // Arrange
    const fake = new FakeRiotClient(
      () => new Promise<RiotMatchPayload>((resolve) => setTimeout(() => resolve(finished), 100)),
    );
    const breaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 10_000,
      now: () => 0,
    });
    const client = new ResilientRiotClient(fake, breaker, {
      timeoutMs: 10,
      retries: 0,
      baseDelayMs: 0,
    });

    // Act / Assert
    await expect(client.getMatch('m')).rejects.toBeInstanceOf(TimeoutError);
  });
});
