export const ID_GENERATOR = Symbol('IdentityIdGenerator');

export interface IdGenerator {
  next(): string;
}
