import { UnitOfWork } from '../application/ports/UnitOfWork';

/** UnitOfWork sans transaction (mode en mémoire / sans DATABASE_URL) : exécute le travail tel quel. */
export class NoopUnitOfWork implements UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
