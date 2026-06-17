import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

// Adapter ENTRANT « horloge » : déclencheur temporel des use cases existants, au même titre
// qu'un controller HTTP est un déclencheur « requête ». Découplé des classes concrètes
// (IngestUpcomingMatches / SyncFeedResults) par des interfaces minimales → testable sans réseau.
export interface FeedIngestor {
  execute(): Promise<unknown>;
}

export interface FeedResultsSync {
  execute(): Promise<unknown>;
}

export interface EsportsFeedSchedulerOptions {
  enabled: boolean;
  intervalMs: number;
}

// Rafraîchissement AUTO du feed (app « vivante » façon Winamax) : périodiquement et sans clic,
// (1) ingère les matchs à venir, puis (2) synchronise les résultats + règle les paris terminés.
// Money-safety : le scheduler ne fait que DÉCLENCHER les use cases existants — ingestion
// idempotente + règlement exactly-once (avec son propre garde de min-interval). Aucune nouvelle
// logique argent, aucun double-règlement. Gardes : gate ENV (OFF par défaut → jamais en test/CI),
// anti-chevauchement (`running`), isolation des erreurs (un run KO ne casse pas l'app ni le suivant).
@Injectable()
export class EsportsFeedScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(EsportsFeedScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly ingest: FeedIngestor,
    private readonly results: FeedResultsSync,
    private readonly options: EsportsFeedSchedulerOptions,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.options.enabled) {
      this.logger.log(
        'Scheduler feed e-sport inerte (ESPORTS_SCHEDULER_ENABLED absent) — refresh auto OFF.',
      );
      return;
    }
    this.timer = setInterval(() => void this.runOnce(), this.options.intervalMs);
    this.logger.log(
      `Scheduler feed e-sport actif (refresh auto toutes les ${this.options.intervalMs}ms).`,
    );
  }

  // Un tick = ingestion PUIS synchro résultats. Séquentiel (la synchro peut régler des marchés
  // tout juste ingérés). Chaque étape est isolée : son échec est journalisé et le tick se termine
  // proprement (jamais de rejet → pas d'unhandledRejection sur le `void` de setInterval).
  async runOnce(): Promise<void> {
    if (this.running) {
      // Anti-chevauchement : un tick précédent est encore en vol (feed lent). On saute ce tick.
      return;
    }
    this.running = true;
    try {
      await this.safely('ingestion', () => this.ingest.execute());
      await this.safely('synchro résultats', () => this.results.execute());
    } finally {
      this.running = false;
    }
  }

  private async safely(label: string, run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (error) {
      // Feed down / étape KO : on dégrade sans crasher. Le prochain tick réessaiera.
      this.logger.error(`Échec ${label} (le prochain tick réessaiera).`, error as Error);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
