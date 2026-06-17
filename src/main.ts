import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiConfig } from './openapi.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('bootstrap');

  // Postgres est le store PERSISTANT PAR DÉFAUT : l'app refuse de démarrer en mémoire (BET-19).
  // Le mode en mémoire reste possible pour les tests / la génération de contrat (qui bootent
  // AppModule directement, sans passer par ce point d'entrée).
  if (!process.env.DATABASE_URL) {
    logger.error(
      'DATABASE_URL manquant : BetNext tourne sur Postgres (store persistant). ' +
        'Lancez `docker compose up -d postgres`, copiez `.env.example` en `.env`, puis `npm run db:seed`. ' +
        'Le mode en mémoire est réservé aux tests.',
    );
    process.exit(1);
  }
  if (!process.env.AUTH_SECRET) {
    logger.error(
      'AUTH_SECRET manquant : requis pour signer/vérifier les tokens (BET-20). ' +
        'Définissez un secret aléatoire dans `.env` (voir `.env.example`). Aucun secret par défaut en prod.',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors(); // le front (Next.js) appelle l'API cross-origin
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup('docs', app, document); // UI navigable: /docs ; spec brut: /docs-json
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  logger.log(`BetNext démarré sur le port ${port} (Postgres).`);
}

void bootstrap();
