/**
 * Stockage du token (POC : localStorage). Un httpOnly cookie serait plus robuste contre le XSS, mais
 * hors périmètre. Source unique lue par le middleware du client API (ajout du header Authorization)
 * et par le contexte d'auth. Notifie ses abonnés à chaque changement (ex. 401 → purge → retour login).
 */
const KEY = 'betnext.token';
const listeners = new Set<() => void>();

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, token);
  listeners.forEach((l) => l());
}

export function clearToken(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function onTokenChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
