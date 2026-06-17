import { Global, Module } from '@nestjs/common';
import { CommandBus, CqrsModule } from '@nestjs/cqrs';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlaceBet } from './application/PlaceBet';
import { IdempotentPlaceBet } from './application/IdempotentPlaceBet';
import { PlaceBetHandler } from './application/PlaceBetHandler';
import { GetBetHandler } from './application/GetBetHandler';
import { ListBetsHandler } from './application/ListBetsHandler';
import { GetBetHistoryHandler } from './application/GetBetHistoryHandler';
import { GetPlayerStatsHandler } from './application/GetPlayerStatsHandler';
import { SettleMarket } from './application/SettleMarket';
import { SettleMarketHandler } from './application/SettleMarketHandler';
import { SettlementStrategyFactory } from './application/SettlementStrategyFactory';
import { BET_REPOSITORY, BetRepository } from './application/ports/BetRepository';
import { OddsProvider } from './application/ports/OddsProvider';
import { IdGenerator } from './application/ports/IdGenerator';
import { UNIT_OF_WORK, UnitOfWork } from './application/ports/UnitOfWork';
import { IDEMPOTENCY_STORE, IdempotencyStore } from './application/ports/IdempotencyStore';
import { WALLET_DEBIT_PORT, WalletDebitPort } from '../../shared-kernel/ports/WalletDebitPort';
import { WALLET_CREDIT_PORT, WalletCreditPort } from '../../shared-kernel/ports/WalletCreditPort';
import { STAKE_GUARD_PORT, StakeGuardPort } from '../../shared-kernel/ports/StakeGuardPort';
import { TransactionContext } from '../../persistence/TransactionContext';
import { ODDS_READ_MODEL, OddsReadModel } from '../../read-model/OddsReadModel';
import { InMemoryBetRepository } from './infrastructure/InMemoryBetRepository';
import { TypeOrmBetRepository } from './infrastructure/persistence/TypeOrmBetRepository';
import { TypeOrmUnitOfWork } from './infrastructure/persistence/TypeOrmUnitOfWork';
import { NoopUnitOfWork } from './infrastructure/NoopUnitOfWork';
import { TypeOrmIdempotencyStore } from './infrastructure/persistence/TypeOrmIdempotencyStore';
import { InMemoryIdempotencyStore } from './infrastructure/InMemoryIdempotencyStore';
import { ReadModelOddsProvider } from './infrastructure/ReadModelOddsProvider';
import { UuidIdGenerator } from './infrastructure/UuidIdGenerator';
import { BettingController } from './infrastructure/http/BettingController';
import { SettlementController } from './infrastructure/http/SettlementController';
import {
  MARKET_SETTLEMENT_PORT,
  MarketSettlementPort,
} from '../../shared-kernel/ports/MarketSettlementPort';
import { CommandBusMarketSettlement } from './infrastructure/CommandBusMarketSettlement';

export const BETTING_TOKENS = {
  OddsProvider: Symbol('OddsProvider'),
  IdGenerator: Symbol('IdGenerator'),
} as const;

@Global()
@Module({
  imports: [CqrsModule],
  controllers: [BettingController, SettlementController],
  providers: [
    {
      provide: BETTING_TOKENS.OddsProvider,
      useFactory: (readModel: OddsReadModel): OddsProvider => new ReadModelOddsProvider(readModel),
      inject: [ODDS_READ_MODEL],
    },
    { provide: BETTING_TOKENS.IdGenerator, useClass: UuidIdGenerator },
    {
      provide: BET_REPOSITORY,
      useFactory: (context: TransactionContext, dataSource?: DataSource): BetRepository =>
        dataSource ? new TypeOrmBetRepository(dataSource, context) : new InMemoryBetRepository(),
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: UNIT_OF_WORK,
      useFactory: (context: TransactionContext, dataSource?: DataSource): UnitOfWork =>
        dataSource ? new TypeOrmUnitOfWork(dataSource, context) : new NoopUnitOfWork(),
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: IDEMPOTENCY_STORE,
      useFactory: (context: TransactionContext, dataSource?: DataSource): IdempotencyStore =>
        dataSource
          ? new TypeOrmIdempotencyStore(dataSource, context)
          : new InMemoryIdempotencyStore(),
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: PlaceBet,
      useFactory: (
        bets: BetRepository,
        odds: OddsProvider,
        wallet: WalletDebitPort,
        ids: IdGenerator,
        uow: UnitOfWork,
        stakeGuard: StakeGuardPort,
      ): PlaceBet => new PlaceBet(bets, odds, wallet, ids, uow, stakeGuard),
      inject: [
        BET_REPOSITORY,
        BETTING_TOKENS.OddsProvider,
        WALLET_DEBIT_PORT,
        BETTING_TOKENS.IdGenerator,
        UNIT_OF_WORK,
        STAKE_GUARD_PORT,
      ],
    },
    {
      provide: IdempotentPlaceBet,
      useFactory: (
        placeBet: PlaceBet,
        store: IdempotencyStore,
        uow: UnitOfWork,
      ): IdempotentPlaceBet => new IdempotentPlaceBet(placeBet, store, uow),
      inject: [PlaceBet, IDEMPOTENCY_STORE, UNIT_OF_WORK],
    },
    {
      provide: SettlementStrategyFactory,
      useFactory: (): SettlementStrategyFactory => new SettlementStrategyFactory(),
    },
    {
      provide: SettleMarket,
      useFactory: (
        bets: BetRepository,
        credit: WalletCreditPort,
        factory: SettlementStrategyFactory,
        uow: UnitOfWork,
      ): SettleMarket => new SettleMarket(bets, credit, factory, uow),
      inject: [BET_REPOSITORY, WALLET_CREDIT_PORT, SettlementStrategyFactory, UNIT_OF_WORK],
    },
    {
      provide: MARKET_SETTLEMENT_PORT,
      useFactory: (commandBus: CommandBus): MarketSettlementPort =>
        new CommandBusMarketSettlement(commandBus),
      inject: [CommandBus],
    },
    PlaceBetHandler,
    GetBetHandler,
    ListBetsHandler,
    GetBetHistoryHandler,
    GetPlayerStatsHandler,
    SettleMarketHandler,
  ],
  exports: [PlaceBet, IdempotentPlaceBet, SettleMarket, MARKET_SETTLEMENT_PORT],
})
export class BettingModule {}
