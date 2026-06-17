import { DataSource, EntityManager } from 'typeorm';
import { ProcessedMessageRecord } from './ProcessedMessageRecord';

export class IdempotentMessageHandler {
  constructor(private readonly dataSource: DataSource) {}

  async handle(
    messageId: string,
    effect: (manager: EntityManager) => Promise<void>,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const already = await manager.findOne(ProcessedMessageRecord, { where: { messageId } });
      if (already) {
        return;
      }
      await effect(manager);
      await manager.insert(ProcessedMessageRecord, { messageId });
    });
  }
}
