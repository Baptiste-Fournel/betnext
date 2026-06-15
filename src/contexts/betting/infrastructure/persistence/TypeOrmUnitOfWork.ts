import { DataSource } from 'typeorm';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { TransactionContext } from '../../../../persistence/TransactionContext';

/**
 * Impl TypeORM de la couture transactionnelle. RÉENTRANT : si une transaction ambiante existe
 * déjà (TransactionContext), on la REJOINT (pas de nouvelle transaction) — ce qui permet de
 * composer plusieurs opérations (ex. réservation de clé d'idempotence + pari) dans UNE seule
 * transaction. Sinon, on ouvre une transaction et on publie son EntityManager dans le contexte.
 */
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TransactionContext,
  ) {}

  withTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.context.getManager()) {
      return work();
    }
    return this.dataSource.transaction((manager) => this.context.run(manager, work));
  }
}
