import { PlaceBet, PlaceBetInput, PlaceBetOutput } from './PlaceBet';
import { UnitOfWork } from './ports/UnitOfWork';
import { IdempotencyStore } from './ports/IdempotencyStore';
import { IdempotencyConflictError } from '../../../shared-kernel/domain/IdempotencyConflictError';
import { IdempotencyInProgressError } from '../../../shared-kernel/domain/IdempotencyInProgressError';

export interface IdempotentPlaceBetInput extends PlaceBetInput {
  idempotencyKey: string;
  requestHash: string;
}

/**
 * Enveloppe PlaceBet d'une garantie d'idempotence HTTP. Réservation de la clé, création du pari
 * (débit + pari + events + outbox) et enregistrement du résultat sont dans UNE SEULE transaction
 * (UoW réentrant) → aucune fenêtre où deux requêtes passent le contrôle puis créent chacune un pari.
 * Une tentative échouée libère la clé (`release`) → un retry corrigé n'est jamais bloqué (faux 409).
 * Distinct de l'idempotence consommateur (BET-7) : ici c'est l'idempotence d'ÉCRITURE côté API.
 */
export class IdempotentPlaceBet {
  constructor(
    private readonly placeBet: PlaceBet,
    private readonly store: IdempotencyStore,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: IdempotentPlaceBetInput): Promise<PlaceBetOutput> {
    return this.uow.withTransaction(async () => {
      const claim = await this.store.claim(input.idempotencyKey, input.requestHash);
      if (!claim.claimed) {
        if (claim.existing.requestHash !== input.requestHash) {
          throw new IdempotencyConflictError(); // même clé, corps différent → 409
        }
        if (claim.existing.betId === null) {
          throw new IdempotencyInProgressError(); // réservée mais non finie → 425 (défensif)
        }
        return {
          betId: claim.existing.betId,
          lockedOdds: claim.existing.lockedOdds as number,
          potentialGain: claim.existing.potentialGain as number,
        };
      }
      try {
        const result = await this.placeBet.execute({
          userId: input.userId,
          outcomeId: input.outcomeId,
          stake: input.stake,
        });
        await this.store.complete(input.idempotencyKey, result);
        return result;
      } catch (error) {
        // tentative échouée → libère la clé (essentiel en mode sans tx ; sur Postgres le rollback l'annule)
        await this.store.release(input.idempotencyKey).catch(() => undefined);
        throw error;
      }
    });
  }
}
