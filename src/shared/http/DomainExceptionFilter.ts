import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DomainError } from '../../shared-kernel/domain/DomainError';
import { IdempotencyConflictError } from '../../shared-kernel/domain/IdempotencyConflictError';
import { IdempotencyInProgressError } from '../../shared-kernel/domain/IdempotencyInProgressError';

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
}

/**
 * Filtre GLOBAL : mappe les erreurs de domaine sur des statuts HTTP, par TYPE (extensible).
 * Conflit d'idempotence → 409 ; idempotence en cours → 425 ; toute autre violation → 422.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const httpException = this.toHttpException(error);
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    response.status(httpException.getStatus()).json(httpException.getResponse());
  }

  private toHttpException(error: DomainError): HttpException {
    if (error instanceof IdempotencyConflictError) {
      return new ConflictException(error.message);
    }
    if (error instanceof IdempotencyInProgressError) {
      return new HttpException(error.message, 425);
    }
    return new UnprocessableEntityException(error.message);
  }
}
