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
