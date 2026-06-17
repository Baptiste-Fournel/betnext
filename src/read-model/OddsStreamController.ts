import { Controller, Sse } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { OddsStream } from './OddsStream';

class OddsLiveEventDto {
  @ApiProperty({ example: 'lol-finale-a' })
  outcomeId!: string;
  @ApiProperty({ example: 2.35 })
  odds!: number;
}

@ApiTags('streams')
@ApiExtraModels(OddsLiveEventDto)
@Controller('streams')
export class OddsStreamController {
  constructor(private readonly stream: OddsStream) {}

  @Sse('odds')
  @ApiOkResponse({
    description:
      'Flux SSE (text/event-stream) : un message par MAJ ; data = OddsLiveEventDto (JSON).',
    content: { 'text/event-stream': { schema: { $ref: getSchemaPath(OddsLiveEventDto) } } },
  })
  odds(): Observable<{ data: OddsLiveEventDto }> {
    return this.stream.asObservable().pipe(map((event) => ({ data: event })));
  }
}
