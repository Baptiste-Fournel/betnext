import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

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

  async runOnce(): Promise<void> {
    if (this.running) {
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
