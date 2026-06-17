export const ID_GENERATOR = Symbol('IdentityIdGenerator');

/** Génère l'identifiant d'un nouveau compte (impl infra : UUID). */
export interface IdGenerator {
  next(): string;
}
