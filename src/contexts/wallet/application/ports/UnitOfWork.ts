export const UNIT_OF_WORK = Symbol('WalletUnitOfWork');

// Frontière transactionnelle (UnitOfWork) du contexte Wallet. Le crédit/reverse + la ligne ledger
// + la notification Outbox sont commités atomiquement ensemble. Port local au contexte (les
// frontières interdisent d'importer celui d'un autre contexte).
export interface UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T>;
}
