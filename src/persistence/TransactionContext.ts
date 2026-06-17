import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager } from 'typeorm';

export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  run<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return this.storage.run(manager, work);
  }

  getManager(): EntityManager | undefined {
    return this.storage.getStore();
  }
}
