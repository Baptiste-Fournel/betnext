import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { OddsCalculator } from './contexts/pricing/domain/OddsCalculator';
import { RecalculateOddsOnBetPlaced } from './contexts/pricing/application/RecalculateOddsOnBetPlaced';
import { QueueOddsPublisher } from './contexts/pricing/infrastructure/QueueOddsPublisher';
import { RedisPricingStore } from './contexts/pricing/infrastructure/RedisPricingStore';
import { PricingWorker } from './contexts/pricing/infrastructure/PricingWorker';
import { BullMqQueueAdapter } from './messaging/BullMqQueueAdapter';
import { DOMAIN_EVENTS_QUEUE, ODDS_QUEUE } from './messaging/topics';
import { redisConnectionFromUrl } from './messaging/redisConnection';

async function bootstrap(): Promise<void> {
  const logger = new Logger('PricingService');
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.error('REDIS_URL requis : le service Pricing ne communique que par le bus.');
    process.exit(1);
    return;
  }
  const connection = redisConnectionFromUrl(redisUrl);
  const redis = new Redis(redisUrl);
  const oddsQueue = new Queue(ODDS_QUEUE, { connection });
  const recalc = new RecalculateOddsOnBetPlaced(
    new RedisPricingStore(redis),
    new OddsCalculator(),
    new QueueOddsPublisher(new BullMqQueueAdapter(oddsQueue)),
  );
  const worker = new PricingWorker(DOMAIN_EVENTS_QUEUE, connection, recalc).start();
  logger.log(`Service Pricing démarré : consomme ${DOMAIN_EVENTS_QUEUE}, publie ${ODDS_QUEUE}.`);

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await oddsQueue.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void bootstrap();
