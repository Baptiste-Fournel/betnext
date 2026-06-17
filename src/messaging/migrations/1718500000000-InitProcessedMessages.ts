import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitProcessedMessages1718500000000 implements MigrationInterface {
  name = 'InitProcessedMessages1718500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "processed_messages" ("messageId" uuid PRIMARY KEY, "processedAt" timestamptz NOT NULL DEFAULT now());`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "processed_messages";`);
  }
}
