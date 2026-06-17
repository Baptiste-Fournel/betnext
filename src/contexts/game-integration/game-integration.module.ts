import { Module } from '@nestjs/common';
import {
  MARKET_SETTLEMENT_PORT,
  MarketSettlementPort,
} from '../../shared-kernel/ports/MarketSettlementPort';
import { GAME_PROVIDER, GameProvider } from './application/ports/GameProvider';
import { MATCH_LINK_STORE, MatchLinkStore } from './application/ports/MatchLinkStore';
import { RegisterMatchLink } from './application/RegisterMatchLink';
import { SyncMatchResult } from './application/SyncMatchResult';
import { RIOT_CLIENT, RiotClient } from './infrastructure/riot/RiotClient';
import { HttpRiotClient } from './infrastructure/riot/HttpRiotClient';
import { StubRiotClient } from './infrastructure/riot/StubRiotClient';
import { ResilientRiotClient } from './infrastructure/riot/ResilientRiotClient';
import { CircuitBreaker } from './infrastructure/resilience/circuit-breaker';
import { RiotGameProvider } from './infrastructure/RiotGameProvider';
import { InMemoryMatchLinkStore } from './infrastructure/InMemoryMatchLinkStore';
import { GameIntegrationController } from './infrastructure/http/GameIntegrationController';

/**
 * Contexte Game Integration (BET-21). Parle au reste via PORTS uniquement : il consomme le port
 * partagé `MARKET_SETTLEMENT_PORT` (fourni par Betting) pour régler — sans importer l'intérieur de
 * Betting (frontières vérifiées par dependency-cruiser). Le client Riot est RÉSILIENT (CB/timeout/
 * retry) ; sans `RIOT_API_KEY`, on bascule sur un STUB → l'app démarre et la CI tournent sans clé.
 */
@Module({
  controllers: [GameIntegrationController],
  providers: [
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
    { provide: MATCH_LINK_STORE, useFactory: (): MatchLinkStore => new InMemoryMatchLinkStore() },
    {
      provide: RegisterMatchLink,
      useFactory: (store: MatchLinkStore): RegisterMatchLink => new RegisterMatchLink(store),
      inject: [MATCH_LINK_STORE],
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
