import { OnModuleDestroy } from '@nestjs/common';
import { OddsReadModel, OddsView } from './OddsReadModel';

/** Sous-ensemble ioredis utilisé (injecté → testable, pas de couplage dur). */
export interface RedisLike {
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  quit(): Promise<unknown>;
}

const ODDS_KEY = 'readmodel:odds';
const TS_KEY = 'readmodel:odds:ts';

/**
 * Read-model des cotes dans Redis (hash). PARTAGÉ et reconstructible ; jamais autoritatif (source
 * de vérité = OddsUpdated / Pricing). Lecture O(1) hors base d'écriture. GARDE MONOTONE par
 * `occurredAt` (hash parallèle) → un snapshot plus ancien n'écrase pas un plus récent.
 * Le read-then-write est sûr avec un projecteur unique (concurrency=1) ; l'atomicité multi-réplique
 * (script Lua compare-and-set) est une évolution prod (dette tracée), inutile au POC mono-instance.
 * Ferme le client Redis au shutdown (OnModuleDestroy) → pas de fuite de connexion.
 */
export class RedisOddsReadModel implements OddsReadModel, OnModuleDestroy {
  constructor(private readonly redis: RedisLike) {}

  async current(outcomeId: string): Promise<number | null> {
    const value = await this.redis.hget(ODDS_KEY, outcomeId);
    return value == null ? null : Number(value);
  }

  async put(views: OddsView[], occurredAt: number): Promise<void> {
    for (const view of views) {
      const storedTs = await this.redis.hget(TS_KEY, view.outcomeId);
      if (storedTs != null && occurredAt < Number(storedTs)) {
        continue; // snapshot plus ancien → on n'écrase pas une cote plus récente
      }
      await this.redis.hset(ODDS_KEY, view.outcomeId, String(view.odds));
      await this.redis.hset(TS_KEY, view.outcomeId, String(occurredAt));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
