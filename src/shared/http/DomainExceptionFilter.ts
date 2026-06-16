import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainError } from '../../shared-kernel/domain/DomainError';

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
}

/**
 * Filtre GLOBAL : mappe DomainError → HTTP via l'indice `status` porté PAR l'erreur (open/closed —
 * une nouvelle erreur métier fixe son propre statut, le filtre ne change jamais). Défaut : 422
 * (invariant métier). Ex. : conflit d'idempotence 409, idempotence en cours 425, plafond RG 403.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const status = error.status ?? 422;
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    response.status(status).json({ statusCode: status, message: error.message });
  }
}
