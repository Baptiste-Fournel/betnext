import { Module } from '@nestjs/common';
import { PlaceBet } from './application/PlaceBet';
import { BetRepository } from './application/ports/BetRepository';
import { OddsProvider } from './application/ports/OddsProvider';
import { WalletPort } from './application/ports/WalletPort';
import { IdGenerator } from './application/ports/IdGenerator';
import { InMemoryBetRepository } from './infrastructure/InMemoryBetRepository';
import { StaticOddsProvider } from './infrastructure/StaticOddsProvider';
import { InMemoryWalletAdapter } from './infrastructure/InMemoryWalletAdapter';
import { UuidIdGenerator } from './infrastructure/UuidIdGenerator';

/** Jetons d'injection pour les ports (Dependency Inversion : on injecte des interfaces). */
export const BETTING_TOKENS = {
  BetRepository: Symbol('BetRepository'),
  OddsProvider: Symbol('OddsProvider'),
  WalletPort: Symbol('WalletPort'),
  IdGenerator: Symbol('IdGenerator'),
} as const;

@Module({
  providers: [
    { provide: BETTING_TOKENS.BetRepository, useClass: InMemoryBetRepository },
    { provide: BETTING_TOKENS.OddsProvider, useClass: StaticOddsProvider },
    { provide: BETTING_TOKENS.WalletPort, useClass: InMemoryWalletAdapter },
    { provide: BETTING_TOKENS.IdGenerator, useClass: UuidIdGenerator },
    {
      provide: PlaceBet,
      useFactory: (
        bets: BetRepository,
        odds: OddsProvider,
        wallet: WalletPort,
        ids: IdGenerator,
      ): PlaceBet => new PlaceBet(bets, odds, wallet, ids),
      inject: [
        BETTING_TOKENS.BetRepository,
        BETTING_TOKENS.OddsProvider,
        BETTING_TOKENS.WalletPort,
        BETTING_TOKENS.IdGenerator,
      ],
    },
  ],
  exports: [PlaceBet],
})
export class BettingModule {}
