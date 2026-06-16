import { Module } from '@nestjs/common';
import { MARKET_CATALOG, MarketCatalog } from './application/ports/MarketCatalog';
import { CreateMarket } from './application/CreateMarket';
import { InMemoryMarketCatalog } from './infrastructure/InMemoryMarketCatalog';
import { CatalogController } from './infrastructure/http/CatalogController';

/** Contexte Catalog : marchés/événements (N-issues). Lecture + création ; catalogue en mémoire (POC). */
@Module({
  controllers: [CatalogController],
  providers: [
    { provide: MARKET_CATALOG, useClass: InMemoryMarketCatalog },
    {
      provide: CreateMarket,
      useFactory: (catalog: MarketCatalog): CreateMarket => new CreateMarket(catalog),
      inject: [MARKET_CATALOG],
    },
  ],
})
export class CatalogModule {}
