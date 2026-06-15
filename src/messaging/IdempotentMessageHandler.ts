import { DataSource, EntityManager } from 'typeorm';
import { ProcessedMessageRecord } from './ProcessedMessageRecord';

/**
 * Garantit qu'un message (par son id) n'est traité qu'UNE fois (livraison at-least-once). L'effet
 * métier et l'enregistrement du dé-doublonnage sont dans la MÊME transaction → atomiques. La clé
 * primaire de `processed_messages` est le garde-fou réel (y compris en cas de double-livraison
 * concurrente : la 2e insertion viole la PK et son effet est annulé). C'est le garant pérenne de
 * l'idempotence (la dédup BullMQ par jobId est bornée) ; sa purge/rétention est repoussée (dette assumée).
 */
export class IdempotentMessageHandler {
  constructor(private readonly dataSource: DataSource) {}

  async handle(
    messageId: string,
    effect: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const already = await manager.findOne(ProcessedMessageRecord, { where: { messageId } });
      if (already) {
        return; // déjà traité → no-op
      }
      await effect(manager);
      await manager.insert(ProcessedMessageRecord, { messageId });
    });
  }
}
