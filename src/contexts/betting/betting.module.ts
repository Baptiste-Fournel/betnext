import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlaceBet } from './application/PlaceBet';
import { PlaceBetHandler } from './application/PlaceBetHandler';
import { BET_REPOSITORY, BetRepository } from './application/ports/BetRepository';
import { OddsProvider } from './application/ports/OddsProvider';
import { WalletPort } from './application/ports/WalletPort';
import { IdGenerator } from './application/ports/IdGenerator';
import { InMemoryBetRepository } from './infrastructure/InMemoryBetRepository';
import { TypeOrmBetRepository } from './infrastructure/persistence/TypeOrmBetRepository';
import { StaticOddsProvider } from './infrastructure/StaticOddsProvider';
import { InMemoryWalletAdapter } from './infrastructure/InMemoryWalletAdapter';
import { UuidIdGenerator } from './infrastructure/UuidIdGenerator';
import { BettingController } from './infrastructure/http/BettingController';
import { TransactionContext } from '../../persistence/TransactionContext';

/** Jetons des autres ports (le port BetRepository a son propre jeton BET_REPOSITORY). */
export const BETTING_TOKENS = {
  OddsProvider: Symbol('OddsProvider'),
  WalletPort: Symbol('WalletPort'),
  IdGenerator: Symbol('IdGenerator'),
} as const;

@Module({
  imports: [CqrsModule],
  controllers: [BettingController],
  providers: [
    TransactionContext,
    { provide: BETTING_TOKENS.OddsProvider, useClass: StaticOddsProvider },
    { provide: BETTING_TOKENS.WalletPort, useClass: InMemoryWalletAdapter },
    { provide: BETTING_TOKENS.IdGenerator, useClass: UuidIdGenerator },
    {
      // Postgres si une connexion TypeORM existe (DATABASE_URL), sinon en mémoire — ADR-006.
      provide: BET_REPOSITORY,
      useFactory: (context: TransactionContext, dataSource?: DataSource): BetRepository =>
        dataSource ? new TypeOrmBetRepository(dataSource, context) : new InMemoryBetRepository(),
      inject: [TransactionContext, { token: getDataSourceToken(), optional: true }],
    },
    {
      provide: PlaceBet,
      useFactory: (
        bets: BetRepository,
        odds: OddsProvider,
        wallet: WalletPort,
        ids: IdGenerator,
      ): PlaceBet => new PlaceBet(bets, odds, wallet, ids),
      inject: [
        BET_REPOSITORY,
        BETTING_TOKENS.OddsProvider,
        BETTING_TOKENS.WalletPort,
        BETTING_TOKENS.IdGenerator,
      ],
    },
    PlaceBetHandler,
  ],
  exports: [PlaceBet],
})
export class BettingModule {}
