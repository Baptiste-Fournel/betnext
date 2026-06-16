import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';

/** Réponse du liveness probe — typée pour apparaître dans l'OpenAPI (→ client front type-safe). */
class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'betnext' })
  service!: string;

  @ApiProperty({ example: '2026-06-16T00:00:00.000Z' })
  timestamp!: string;
}

/** Liveness probe (ops). Hors bounded context : préoccupation transverse d'infrastructure. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse, description: 'Service vivant' })
  check(): HealthResponse {
    return { status: 'ok', service: 'betnext', timestamp: new Date().toISOString() };
  }
}
