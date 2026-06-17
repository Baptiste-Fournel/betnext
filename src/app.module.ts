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
import { ComplianceModule } from './contexts/compliance/compliance.module';
import { IdentityModule } from './contexts/identity/identity.module';
import { GameIntegrationModule } from './contexts/game-integration/game-integration.module';
import { AuthModule } from './shared/auth/auth.module';
import { HealthController } from './health/HealthController';
import { DomainExceptionFilter } from './shared/http/DomainExceptionFilter';

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
    ComplianceModule,
    IdentityModule,
    GameIntegrationModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
