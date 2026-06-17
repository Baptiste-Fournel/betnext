import { CircuitBreaker } from '../resilience/circuit-breaker';
import { withRetry } from '../resilience/with-retry';
import { withTimeout } from '../resilience/with-timeout';
import { RiotClient, RiotMatchPayload } from './RiotClient';

export interface ResilienceOptions {
  timeoutMs: number;
  retries: number;
  baseDelayMs: number;
}

/**
 * Décore un `RiotClient` avec la résilience du défi 3 : `CircuitBreaker( retry( timeout(appel) ) )`.
 * Timeout par tentative ; retry à backoff sur les erreurs transitoires ; un échec DÉFINITIF (après
 * retries) compte 1 vers le breaker → pannes répétées = circuit ouvert (fail-fast). Le breaker est
 * fourni de l'extérieur (état partagé entre appels).
 *
 * DETTE CONNUE (à vérifier avant run live réel, hors POC) :
 * - `withTimeout` borne l'ATTENTE mais n'ANNULE pas le `fetch` sous-jacent (pas d'AbortController) :
 *   la socket Riot vit jusqu'à sa fin naturelle. Impact faible (timer nettoyé, fail-fast OK).
 * - `isRetryable` non câblé ici → toute erreur est retentée (bornée à `retries+1`). Sûr mais une 4xx
 *   déterministe est retentée inutilement. Le 404 « match pas dispo » est déjà neutralisé en amont
 *   (HttpRiotClient → `finished:false`), donc il ne fait jamais tripper le breaker.
 */
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
