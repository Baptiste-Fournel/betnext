import { DocumentBuilder } from '@nestjs/swagger';

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('BetNext API')
    .setDescription(
      'Contrat OpenAPI du back BetNext — source du client TYPÉ du front (généré, non écrit à la main).',
    )
    .setVersion('0.1.0')
    .build();
}
