export interface RetryOptions {
  /** Nombre de RE-tentatives après le 1er essai (total d'essais = retries + 1). */
  retries: number;
  /** Délai de base (ms) ; backoff exponentiel : base * 2^tentative. */
  baseDelayMs: number;
  /** Optionnel : ne retenter que si l'erreur est jugée transitoire. */
  isRetryable?: (error: unknown) => boolean;
  /** Injectable pour les tests (évite d'attendre réellement). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Réessaie `fn` sur erreur, avec backoff exponentiel (défi 3). S'arrête au succès, à l'épuisement des
 * tentatives, ou si `isRetryable` rejette l'erreur (ex. une 4xx déterministe n'est pas retentée).
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = options.isRetryable ? options.isRetryable(error) : true;
      if (attempt === options.retries || !retryable) {
        break;
      }
      await sleep(options.baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
