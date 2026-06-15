import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager } from 'typeorm';

/**
 * Couture transactionnelle : porte l'EntityManager de la transaction courante.
 * La UnitOfWork ouvre la transaction et publie le manager ici ; les repositories le récupèrent
 * pour REJOINDRE cette transaction (au lieu d'en ouvrir une autre). Permet à BET-5 d'envelopper
 * débit wallet + pari + événements dans une seule transaction, sans fuite d'ORM dans le port.
 */
export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  run<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return this.storage.run(manager, work);
  }

  getManager(): EntityManager | undefined {
    return this.storage.getStore();
  }
}
