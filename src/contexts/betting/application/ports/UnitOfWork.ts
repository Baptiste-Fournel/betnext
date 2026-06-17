export const UNIT_OF_WORK = Symbol('UnitOfWork');

export interface UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}
