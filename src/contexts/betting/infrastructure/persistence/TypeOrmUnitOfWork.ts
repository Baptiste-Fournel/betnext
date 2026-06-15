import { DataSource } from 'typeorm';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { TransactionContext } from '../../../../persistence/TransactionContext';

/**
 * Impl TypeORM de la couture transactionnelle (BET-5). Ouvre une transaction et publie son
 * EntityManager dans le TransactionContext : tous les repositories appelés dans `work`
 * REJOIGNENT cette transaction. NON câblé dans PlaceBet à ce stade (réservé à BET-5).
 */
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: TransactionContext,
  ) {}

  withTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) => this.context.run(manager, work));
  }
}
