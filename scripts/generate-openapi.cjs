/* eslint-disable */
// Génère le contrat OpenAPI (packages/api-contract/openapi.json) à partir du back, SANS démarrer de
// serveur : boote AppModule en mémoire (sans DATABASE_URL/REDIS_URL), scanne les routes, écrit le spec.
// Source de vérité du client typé du front. Lancer : npm run openapi:generate
require('reflect-metadata');
const { writeFileSync, mkdirSync } = require('node:fs');
const { NestFactory } = require('@nestjs/core');
const { SwaggerModule } = require('@nestjs/swagger');
const { AppModule } = require('../dist/app.module.js');
const { buildOpenApiConfig } = require('../dist/openapi.config.js');

(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  mkdirSync('packages/api-contract', { recursive: true });
  writeFileSync('packages/api-contract/openapi.json', JSON.stringify(document, null, 2) + '\n');
  await app.close();
  console.log('openapi.json genere. Paths:', Object.keys(document.paths).join(', '));
  process.exit(0);
})().catch((e) => {
  console.error('ECHEC generate-openapi:', e && e.stack ? e.stack : e);
  process.exit(1);
});
