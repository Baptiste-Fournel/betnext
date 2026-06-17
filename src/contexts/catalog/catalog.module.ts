import { Global, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  MARKET_CREATION_PORT,
  MarketCreationPort,
} from '../../shared-kernel/ports/MarketCreationPort';
import { MARKET_CATALOG, MarketCatalog } from './application/ports/MarketCatalog';
import { CreateMarket } from './application/CreateMarket';
import { InMemoryMarketCatalog } from './infrastructure/InMemoryMarketCatalog';
import { TypeOrmMarketCatalog } from './infrastructure/persistence/TypeOrmMarketCatalog';
import { CatalogMarketCreation } from './infrastructure/CatalogMarketCreation';
import { CatalogController } from './infrastructure/http/CatalogController';

@Global()
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
    {
      provide: MARKET_CREATION_PORT,
      useFactory: (createMarket: CreateMarket): MarketCreationPort =>
        new CatalogMarketCreation(createMarket),
      inject: [CreateMarket],
    },
  ],
  exports: [MARKET_CREATION_PORT],
})
export class CatalogModule {}
