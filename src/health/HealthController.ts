import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';

class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ example: 'betnext' })
  service!: string;

  @ApiProperty({ example: '2026-06-16T00:00:00.000Z' })
  timestamp!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse, description: 'Service vivant' })
  check(): HealthResponse {
    return { status: 'ok', service: 'betnext', timestamp: new Date().toISOString() };
  }
}
