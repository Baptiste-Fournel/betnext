/** Erreur de délai dépassé (distincte d'une erreur métier → permet un traitement dédié). */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Délai dépassé après ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Borne le temps d'un appel (défi 3 sur dépendance externe) : si `fn` n'a pas résolu en `ms`, rejette
 * avec `TimeoutError`. Le timer est toujours nettoyé. Pur, sans dépendance.
 */
export async function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
