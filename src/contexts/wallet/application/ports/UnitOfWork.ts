export const UNIT_OF_WORK = Symbol('WalletUnitOfWork');

export interface UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}
