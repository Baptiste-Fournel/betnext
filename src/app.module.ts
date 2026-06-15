import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PersistenceModule } from './persistence/persistence.module';
import { MessagingModule } from './messaging/messaging.module';
import { ReadModelModule } from './read-model/read-model.module';
import { BettingModule } from './contexts/betting/betting.module';
import { PricingModule } from './contexts/pricing/pricing.module';
import { WalletModule } from './contexts/wallet/wallet.module';
import { CatalogModule } from './contexts/catalog/catalog.module';
import { HealthController } from './health/HealthController';
import { DomainExceptionFilter } from './shared/http/DomainExceptionFilter';

/**
 * Monolithe modulaire (ADR-001). PersistenceModule (Postgres si DATABASE_URL), MessagingModule
 * (relais Outbox au boot — BET-8), ReadModelModule (read-model cotes + projecteur OddsUpdated —
 * BET-10). Le filtre global mappe DomainError → HTTP (ADR-006).
 */
@Module({
  imports: [
    PersistenceModule.forRoot(),
    MessagingModule,
    ReadModelModule,
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
