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

/** Payload d'un event SSE de cote — enregistré dans le contrat (@ApiExtraModels) → type généré côté front. */
class OddsLiveEventDto {
  @ApiProperty({ example: 'lol-finale-a' })
  outcomeId!: string;
  @ApiProperty({ example: 2.35 })
  odds!: number;
}

/**
 * Flux SSE des cotes EN DIRECT (`GET /streams/odds`). Alimenté par le VRAI pipeline async : chaque
 * OddsUpdated consommé par le projecteur est poussé ici (pas de polling). Format SSE (OpenAPI ne
 * l'exprime pas nativement) : par message, `data` = un `OddsLiveEventDto` en JSON. Nest ferme
 * l'abonnement de chaque client à la déconnexion ; le flux est complété au shutdown (OddsStream).
 */
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
