export function apiMessage(error: unknown, status?: number): string {
  const prefix = status ? `${status} — ` : '';
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    return prefix + (Array.isArray(message) ? message.join(', ') : String(message));
  }
  return prefix + 'Erreur';
}
