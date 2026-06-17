import { UnitOfWork } from '../application/ports/UnitOfWork';

export class NoopUnitOfWork implements UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
