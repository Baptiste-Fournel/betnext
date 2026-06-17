import { DataSource } from 'typeorm';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { TransactionContext } from '../../../../persistence/TransactionContext';

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
