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
import { InMemoryMatchLinkStore } from './infrastructure/InMemoryMatchLinkStore';
import { RIOT_CLIENT, RiotClient } from './infrastructure/riot/RiotClient';
import { HttpRiotClient } from './infrastructure/riot/HttpRiotClient';
import { StubRiotClient } from './infrastructure/riot/StubRiotClient';
import { ResilientRiotClient } from './infrastructure/riot/ResilientRiotClient';
import { CircuitBreaker } from './infrastructure/resilience/circuit-breaker';
import { RiotGameProvider } from './infrastructure/RiotGameProvider';
import { LolEsportsScheduleProvider } from './infrastructure/esports/LolEsportsScheduleProvider';
import { FixtureEsportsScheduleProvider } from './infrastructure/esports/FixtureEsportsScheduleProvider';
import { ResilientScheduleProvider } from './infrastructure/esports/ResilientScheduleProvider';
import { FallbackEsportsScheduleProvider } from './infrastructure/esports/FallbackEsportsScheduleProvider';
import { EsportsIngestionController } from './infrastructure/http/EsportsIngestionController';
import { UpcomingMatchesController } from './infrastructure/http/UpcomingMatchesController';

@Module({
  controllers: [EsportsIngestionController, UpcomingMatchesController],
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
      // Sélection live/fixtures par config (ENV). Base URL + clé JAMAIS en dur. Sans config →
      // fixtures (CI/démo hors-ligne). Avec config → source live durcie (timeout/retry) +
      // bascule automatique sur fixtures si injoignable (jamais d'app cassée).
      provide: ESPORTS_SCHEDULE_PROVIDER,
      useFactory: (): EsportsScheduleProvider => {
        const fixtures = new FixtureEsportsScheduleProvider();
        const baseUrl = process.env.ESPORTS_API_BASE_URL;
        const apiKey = process.env.ESPORTS_API_KEY;
        if (!baseUrl || !apiKey) {
          return fixtures;
        }
        const live = new ResilientScheduleProvider(
          new LolEsportsScheduleProvider(baseUrl, apiKey),
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
    // --- Moteur de règlement-par-résultat (ACL + exactly-once) ---
    // Conservé et câblé, PRÊT pour le futur driver « résultats esports auto » (ticket suivant)
    // qui le déclenchera. Pas d'endpoint manuel ici (flux featured/sync manuel retiré).
    {
      provide: RIOT_CLIENT,
      useFactory: (): RiotClient => {
        const key = process.env.RIOT_API_KEY;
        const base: RiotClient = key ? new HttpRiotClient(key) : new StubRiotClient();
        const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 });
        return new ResilientRiotClient(base, breaker, {
          timeoutMs: 2_000,
          retries: 2,
          baseDelayMs: 200,
        });
      },
    },
    {
      provide: GAME_PROVIDER,
      useFactory: (client: RiotClient): GameProvider => new RiotGameProvider(client),
      inject: [RIOT_CLIENT],
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
  ],
})
export class GameIntegrationModule {}
