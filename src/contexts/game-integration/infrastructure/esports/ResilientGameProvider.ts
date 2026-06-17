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

// Durcit les appels de RÉSULTATS à la source externe (instable) : timeout + retry + circuit
// breaker. Si tout échoue, l'erreur remonte au déclencheur (`SyncFeedResults`) qui la rattrape
// par match → le match reste à régler plus tard. JAMAIS de bascule sur des résultats fictifs
// (money-safety : on ne règle pas sur de fausses données).
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
