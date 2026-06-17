import { CircuitBreaker } from '../resilience/circuit-breaker';
import { withRetry } from '../resilience/with-retry';
import { withTimeout } from '../resilience/with-timeout';
import { RiotClient, RiotMatchPayload } from './RiotClient';

export interface ResilienceOptions {
  timeoutMs: number;
  retries: number;
  baseDelayMs: number;
}

export class ResilientRiotClient implements RiotClient {
  constructor(
    private readonly inner: RiotClient,
    private readonly breaker: CircuitBreaker,
    private readonly options: ResilienceOptions,
  ) {}

  getMatch(matchId: string): Promise<RiotMatchPayload> {
    return this.breaker.call(() =>
      withRetry(() => withTimeout(() => this.inner.getMatch(matchId), this.options.timeoutMs), {
        retries: this.options.retries,
        baseDelayMs: this.options.baseDelayMs,
      }),
    );
  }
}
