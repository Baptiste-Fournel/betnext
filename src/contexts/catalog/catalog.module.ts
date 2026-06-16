import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MARKET_CATALOG, MarketCatalog } from './application/ports/MarketCatalog';
import { CreateMarket } from './application/CreateMarket';
import { InMemoryMarketCatalog } from './infrastructure/InMemoryMarketCatalog';
import { TypeOrmMarketCatalog } from './infrastructure/persistence/TypeOrmMarketCatalog';
import { CatalogController } from './infrastructure/http/CatalogController';

/**
 * Contexte Catalog : marchés/événements (N-issues). Lecture + création. Postgres si
 * `DATABASE_URL` (catalogue persistant — BET-19), sinon en mémoire (tests / contract-gen).
 */
@Module({
  controllers: [CatalogController],
  providers: [
    {
      provide: MARKET_CATALOG,
      useFactory: (dataSource?: DataSource): MarketCatalog =>
        dataSource ? new TypeOrmMarketCatalog(dataSource) : new InMemoryMarketCatalog(),
      inject: [{ token: getDataSourceToken(), optional: true }],
    },
    {
      provide: CreateMarket,
      useFactory: (catalog: MarketCatalog): CreateMarket => new CreateMarket(catalog),
      inject: [MARKET_CATALOG],
    },
  ],
})
export class CatalogModule {}
