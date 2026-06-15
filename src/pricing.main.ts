import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { PricingModule } from './contexts/pricing/pricing.module';

/**
 * Point d'entrée du SERVICE Pricing extrait (ADR-002). Le même module Nest qui tourne dans le
 * monolithe peut démarrer comme microservice indépendant (transporter TCP) — preuve concrète du
 * "ready-to-split" et du déploiement indépendant (contrainte 3).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(PricingModule, {
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: 3001 },
  });
  await app.listen();
}

void bootstrap();
