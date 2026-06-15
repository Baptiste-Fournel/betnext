import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DomainError } from '../../shared-kernel/domain/DomainError';

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
}

/**
 * Filtre GLOBAL : mappe les erreurs de domaine sur des statuts HTTP. EXTENSIBLE — on route ici
 * les futurs sous-types de DomainError vers des statuts dédiés (404/409/…). Par défaut, une
 * violation d'invariant métier → 422. Évite un 422 codé en dur dans chaque contrôleur.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const httpException = this.toHttpException(error);
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    response.status(httpException.getStatus()).json(httpException.getResponse());
  }

  private toHttpException(error: DomainError): HttpException {
    // Point d'extension : switch sur le type/nom d'erreur pour d'autres statuts.
    return new UnprocessableEntityException(error.message);
  }
}
