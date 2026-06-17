import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitOutbox1718400000000 implements MigrationInterface {
  name = 'InitOutbox1718400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox" (
        "id" uuid PRIMARY KEY,
        "type" varchar NOT NULL,
        "payload" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "publishedAt" timestamptz NULL
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_outbox_unpublished" ON "outbox" ("createdAt") WHERE "publishedAt" IS NULL;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox";`);
  }
}
