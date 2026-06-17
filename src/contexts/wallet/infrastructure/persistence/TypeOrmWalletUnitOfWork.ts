import { DataSource } from 'typeorm';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { TransactionContext } from '../../../../persistence/TransactionContext';

// UnitOfWork du contexte Wallet : ouvre une transaction Postgres et publie l'EntityManager dans le
// TransactionContext (AsyncLocalStorage) pour que les adapters (credit/refund/notif) écrivent tous
// dans la MÊME transaction. Réentrant : si une transaction est déjà ouverte, on la réutilise.
export class TypeOrmWalletUnitOfWork implements UnitOfWork {
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
