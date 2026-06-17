import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainError } from '../../shared-kernel/domain/DomainError';

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
}

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost): void {
    const status = error.status ?? 422;
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    response.status(status).json({ statusCode: status, message: error.message });
  }
}
