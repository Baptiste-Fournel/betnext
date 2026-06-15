import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PersistenceModule } from './persistence/persistence.module';
import { BettingModule } from './contexts/betting/betting.module';
import { PricingModule } from './contexts/pricing/pricing.module';
import { WalletModule } from './contexts/wallet/wallet.module';
import { CatalogModule } from './contexts/catalog/catalog.module';
import { HealthController } from './health/HealthController';
import { DomainExceptionFilter } from './shared/http/DomainExceptionFilter';

/**
 * Monolithe modulaire (ADR-001). PersistenceModule.forRoot() branche Postgres si DATABASE_URL,
 * sinon mode en mémoire. Le filtre global mappe DomainError → HTTP (ADR-006).
 */
@Module({
  imports: [
    PersistenceModule.forRoot(),
    CqrsModule,
    BettingModule,
    PricingModule,
    WalletModule,
    CatalogModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
