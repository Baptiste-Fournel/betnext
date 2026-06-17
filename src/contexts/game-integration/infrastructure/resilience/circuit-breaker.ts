/** Levée quand le circuit est OUVERT : on échoue VITE sans appeler la dépendance en panne. */
export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit ouvert : appel court-circuité (dépendance en panne)');
    this.name = 'CircuitOpenError';
  }
}

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Nombre d'échecs consécutifs avant ouverture. */
  failureThreshold: number;
  /** Durée (ms) avant de retenter (passage OPEN → HALF_OPEN). */
  resetTimeoutMs: number;
  /** Horloge injectable (tests). */
  now?: () => number;
}

/**
 * Circuit Breaker (défi 3 sur dépendance externe). CLOSED : laisse passer ; après `failureThreshold`
 * échecs → OPEN (fail-fast immédiat, la dépendance n'est plus appelée). Après `resetTimeoutMs` → un
 * essai HALF_OPEN : succès → CLOSED, échec → OPEN. Implémentation maison (zéro dépendance, testable).
 */
export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  get currentState(): State {
    return this.state;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.clock() - this.openedAt >= this.options.resetTimeoutMs) {
        this.state = 'HALF_OPEN'; // on autorise UN essai de reprise
      } else {
        throw new CircuitOpenError(); // fail-fast : aucun appel à la dépendance
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = this.clock();
    }
  }

  private clock(): number {
    return this.options.now?.() ?? Date.now();
  }
}
