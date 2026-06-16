/**
 * GARDE DE TYPE-SAFETY (compile-time, NON bundlée — `__contractGuard` n'est jamais appelée donc
 * tree-shakée). Vérifiée par `npm run typecheck` (et en CI) : prouve que le client est typé CONTRE
 * le contrat OpenAPI — la réponse de /health est typée, et un chemin ABSENT du contrat est REJETÉ.
 * Si quelqu'un casse la type-safety (ex. `paths` → any), le `@ts-expect-error` devient inutilisé →
 * le typecheck ÉCHOUE. C'est le filet anti-régression de la garantie « client généré, pas écrit main ».
 */
import { api } from './client';

export async function __contractGuard(): Promise<void> {
  const { data } = await api.GET('/health');
  if (data) {
    const service: string = data.service;
    const timestamp: string = data.timestamp;
    void service;
    void timestamp;
  }
  // @ts-expect-error : chemin absent du contrat OpenAPI → rejeté à la compilation (type-safety réelle).
  await api.GET('/route-absente-du-contrat');
}
