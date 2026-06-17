import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIdempotencyKeys1718600000000 implements MigrationInterface {
  name = 'InitIdempotencyKeys1718600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_keys" (
        "key" varchar PRIMARY KEY,
        "requestHash" varchar NOT NULL,
        "betId" varchar NULL,
        "lockedOdds" numeric(6,2) NULL,
        "potentialGain" numeric(14,2) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys";`);
  }
}
