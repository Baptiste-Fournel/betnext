import { ResilientGameProvider } from './ResilientGameProvider';
import { GameProvider } from '../../application/ports/GameProvider';
import { MatchReport } from '../../domain/MatchReport';
import { CircuitBreaker, CircuitOpenError } from '../../../../shared/resilience/circuit-breaker';

const finished: MatchReport = { matchId: 'm', status: 'FINISHED', winner: 'HOME' };

class FakeProvider implements GameProvider {
  calls = 0;
  constructor(private readonly behavior: (call: number) => Promise<MatchReport>) {}
  fetchMatchReport(): Promise<MatchReport> {
    this.calls += 1;
    return this.behavior(this.calls);
  }
}

describe('ResilientGameProvider (BET-32)', () => {
  it('shouldRetryThenSucceed_WhenFirstAttemptFails', async () => {
    // Arrange
    const fake = new FakeProvider((call) =>
      call === 1 ? Promise.reject(new Error('flaky')) : Promise.resolve(finished),
    );
    const provider = new ResilientGameProvider(
      fake,
      new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10_000, now: () => 0 }),
      { timeoutMs: 50, retries: 2, baseDelayMs: 0 },
    );

    // Act
    const report = await provider.fetchMatchReport('m');

    // Assert
    expect(report).toEqual(finished);
    expect(fake.calls).toBe(2);
  });

  it('shouldOpenCircuitAndShortCircuit_WhenRepeatedFailures', async () => {
    // Arrange
    const fake = new FakeProvider(() => Promise.reject(new Error('source down')));
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 10_000,
      now: () => 0,
    });
    const provider = new ResilientGameProvider(fake, breaker, {
      timeoutMs: 50,
      retries: 1,
      baseDelayMs: 0,
    });

    // Act / Assert
    await expect(provider.fetchMatchReport('m')).rejects.toThrow('source down');
    await expect(provider.fetchMatchReport('m')).rejects.toThrow('source down');
    expect(breaker.currentState).toBe('OPEN');
    await expect(provider.fetchMatchReport('m')).rejects.toThrow(CircuitOpenError);
  });
});
