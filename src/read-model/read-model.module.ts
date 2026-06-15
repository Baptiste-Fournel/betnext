import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ODDS_READ_MODEL, OddsReadModel } from './OddsReadModel';
import { InMemoryOddsReadModel } from './InMemoryOddsReadModel';
import { RedisOddsReadModel } from './RedisOddsReadModel';
import { OddsProjectorService } from './OddsProjectorService';
import { OddsReadController } from './OddsReadController';

/**
 * Côté LECTURE du CQRS (ADR-006). Read-model des cotes : projeté depuis OddsUpdated, lu par le
 * joueur (GET /odds) et par le chemin de placement (ReadModelOddsProvider). Redis si REDIS_URL
 * (partagé/reconstructible), sinon mémoire. Global → instance unique partagée projecteur ↔ lecteurs.
 */
@Global()
@Module({
  controllers: [OddsReadController],
  providers: [
    {
      provide: ODDS_READ_MODEL,
      useFactory: (): OddsReadModel => {
        const redisUrl = process.env.REDIS_URL;
        return redisUrl ? new RedisOddsReadModel(new Redis(redisUrl)) : new InMemoryOddsReadModel();
      },
    },
    OddsProjectorService,
  ],
  exports: [ODDS_READ_MODEL],
})
export class ReadModelModule {}
