import { Module } from '@nestjs/common';
import {
  MARKET_SETTLEMENT_PORT,
  MarketSettlementPort,
} from '../../shared-kernel/ports/MarketSettlementPort';
import {
  MARKET_CREATION_PORT,
  MarketCreationPort,
} from '../../shared-kernel/ports/MarketCreationPort';
import { GAME_PROVIDER, GameProvider } from './application/ports/GameProvider';
import { MATCH_LINK_STORE, MatchLinkStore } from './application/ports/MatchLinkStore';
import {
  ESPORTS_SCHEDULE_PROVIDER,
  EsportsScheduleProvider,
} from './application/ports/EsportsScheduleProvider';
import { IngestMatchMarket } from './application/IngestMatchMarket';
import { ListUpcomingMatches } from './application/ListUpcomingMatches';
import { IngestUpcomingMatches } from './application/IngestUpcomingMatches';
import { SyncMatchResult } from './application/SyncMatchResult';
import { SyncFeedResults } from './application/SyncFeedResults';
import { InMemoryMatchLinkStore } from './infrastructure/InMemoryMatchLinkStore';
import { CircuitBreaker } from '../../shared/resilience/circuit-breaker';
import { LolEsportsScheduleProvider } from './infrastructure/esports/LolEsportsScheduleProvider';
import { FixtureEsportsScheduleProvider } from './infrastructure/esports/FixtureEsportsScheduleProvider';
import { ResilientScheduleProvider } from './infrastructure/esports/ResilientScheduleProvider';
import { FallbackEsportsScheduleProvider } from './infrastructure/esports/FallbackEsportsScheduleProvider';
import { EsportsResultProvider } from './infrastructure/esports/EsportsResultProvider';
import { FixtureEsportsResultProvider } from './infrastructure/esports/FixtureEsportsResultProvider';
import { ResilientGameProvider } from './infrastructure/esports/ResilientGameProvider';
import { EsportsIngestionController } from './infrastructure/http/EsportsIngestionController';
import { EsportsResultsController } from './infrastructure/http/EsportsResultsController';
import { UpcomingMatchesController } from './infrastructure/http/UpcomingMatchesController';
import { EsportsFeedScheduler } from './infrastructure/scheduler/EsportsFeedScheduler';

const esportsConfigured = (): boolean =>
  Boolean(process.env.ESPORTS_API_BASE_URL && process.env.ESPORTS_API_KEY);

const schedulerEnabled = (): boolean =>
  ['1', 'true', 'yes', 'on'].includes((process.env.ESPORTS_SCHEDULER_ENABLED ?? '').toLowerCase());

const schedulerIntervalMs = (): number => {
  const raw = Number(process.env.ESPORTS_SCHEDULER_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 300_000;
};

@Module({
  controllers: [EsportsIngestionController, EsportsResultsController, UpcomingMatchesController],
  providers: [
    { provide: MATCH_LINK_STORE, useFactory: (): MatchLinkStore => new InMemoryMatchLinkStore() },
    {
      provide: IngestMatchMarket,
      useFactory: (markets: MarketCreationPort, store: MatchLinkStore): IngestMatchMarket =>
        new IngestMatchMarket(markets, store),
      inject: [MARKET_CREATION_PORT, MATCH_LINK_STORE],
    },
    {
      provide: ListUpcomingMatches,
      useFactory: (store: MatchLinkStore): ListUpcomingMatches => new ListUpcomingMatches(store),
      inject: [MATCH_LINK_STORE],
    },
    {
      provide: ESPORTS_SCHEDULE_PROVIDER,
      useFactory: (): EsportsScheduleProvider => {
        const fixtures = new FixtureEsportsScheduleProvider();
        if (!esportsConfigured()) {
          return fixtures;
        }
        const live = new ResilientScheduleProvider(
          new LolEsportsScheduleProvider(
            process.env.ESPORTS_API_BASE_URL!,
            process.env.ESPORTS_API_KEY!,
          ),
          { timeoutMs: 4_000, retries: 2, baseDelayMs: 300 },
        );
        return new FallbackEsportsScheduleProvider(live, fixtures);
      },
    },
    {
      provide: IngestUpcomingMatches,
      useFactory: (
        schedule: EsportsScheduleProvider,
        ingestMatch: IngestMatchMarket,
        store: MatchLinkStore,
      ): IngestUpcomingMatches => new IngestUpcomingMatches(schedule, ingestMatch, store),
      inject: [ESPORTS_SCHEDULE_PROVIDER, IngestMatchMarket, MATCH_LINK_STORE],
    },
    {
      provide: GAME_PROVIDER,
      useFactory: (): GameProvider => {
        if (!esportsConfigured()) {
          return new FixtureEsportsResultProvider();
        }
        const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 });
        return new ResilientGameProvider(
          new EsportsResultProvider(
            process.env.ESPORTS_API_BASE_URL!,
            process.env.ESPORTS_API_KEY!,
          ),
          breaker,
          { timeoutMs: 4_000, retries: 2, baseDelayMs: 300 },
        );
      },
    },
    {
      provide: SyncMatchResult,
      useFactory: (
        provider: GameProvider,
        store: MatchLinkStore,
        settlement: MarketSettlementPort,
      ): SyncMatchResult => new SyncMatchResult(provider, store, settlement),
      inject: [GAME_PROVIDER, MATCH_LINK_STORE, MARKET_SETTLEMENT_PORT],
    },
    {
      provide: SyncFeedResults,
      useFactory: (store: MatchLinkStore, settler: SyncMatchResult): SyncFeedResults => {
        const raw = Number(process.env.ESPORTS_SYNC_MIN_INTERVAL_MS);
        const minIntervalMs = Number.isFinite(raw) && raw >= 0 ? raw : 3_000;
        return new SyncFeedResults(store, settler, { minIntervalMs });
      },
      inject: [MATCH_LINK_STORE, SyncMatchResult],
    },
    {
      provide: EsportsFeedScheduler,
      useFactory: (ingest: IngestUpcomingMatches, results: SyncFeedResults): EsportsFeedScheduler =>
        new EsportsFeedScheduler(ingest, results, {
          enabled: schedulerEnabled(),
          intervalMs: schedulerIntervalMs(),
        }),
      inject: [IngestUpcomingMatches, SyncFeedResults],
    },
  ],
})
export class GameIntegrationModule {}
