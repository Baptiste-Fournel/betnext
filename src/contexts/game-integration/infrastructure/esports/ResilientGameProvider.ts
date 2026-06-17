import { GameProvider } from '../../application/ports/GameProvider';
import { MatchReport } from '../../domain/MatchReport';
import { CircuitBreaker } from '../resilience/circuit-breaker';
import { withRetry } from '../resilience/with-retry';
import { withTimeout } from '../resilience/with-timeout';

export interface GameProviderResilienceOptions {
  timeoutMs: number;
  retries: number;
  baseDelayMs: number;
}

export class ResilientGameProvider implements GameProvider {
  constructor(
    private readonly inner: GameProvider,
    private readonly breaker: CircuitBreaker,
    private readonly options: GameProviderResilienceOptions,
  ) {}

  fetchMatchReport(matchId: string): Promise<MatchReport> {
    return this.breaker.call(() =>
      withRetry(
        () => withTimeout(() => this.inner.fetchMatchReport(matchId), this.options.timeoutMs),
        { retries: this.options.retries, baseDelayMs: this.options.baseDelayMs },
      ),
    );
  }
}
