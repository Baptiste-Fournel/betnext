import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ODDS_READ_MODEL, OddsReadModel } from './OddsReadModel';
import { InMemoryOddsReadModel } from './InMemoryOddsReadModel';
import { RedisOddsReadModel } from './RedisOddsReadModel';
import { OddsProjectorService } from './OddsProjectorService';
import { OddsStream } from './OddsStream';
import { OddsReadController } from './OddsReadController';
import { OddsStreamController } from './OddsStreamController';

@Global()
@Module({
  controllers: [OddsReadController, OddsStreamController],
  providers: [
    {
      provide: ODDS_READ_MODEL,
      useFactory: (): OddsReadModel => {
        const redisUrl = process.env.REDIS_URL;
        return redisUrl ? new RedisOddsReadModel(new Redis(redisUrl)) : new InMemoryOddsReadModel();
      },
    },
    OddsStream,
    OddsProjectorService,
  ],
  exports: [ODDS_READ_MODEL],
})
export class ReadModelModule {}
