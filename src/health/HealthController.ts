import { Controller, Get } from '@nestjs/common';

/** Liveness probe (ops). Hors bounded context : préoccupation transverse d'infrastructure. */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; service: string; timestamp: string } {
    return { status: 'ok', service: 'betnext', timestamp: new Date().toISOString() };
  }
}
