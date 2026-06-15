import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BettingModule } from './contexts/betting/betting.module';
import { PricingModule } from './contexts/pricing/pricing.module';
import { WalletModule } from './contexts/wallet/wallet.module';
import { CatalogModule } from './contexts/catalog/catalog.module';

/**
 * Monolithe modulaire (ADR-001) : un module Nest = un bounded context.
 * Les frontières dures sont vérifiées au build par dependency-cruiser (npm run boundaries).
 */
@Module({
  imports: [CqrsModule, BettingModule, PricingModule, WalletModule, CatalogModule],
})
export class AppModule {}
