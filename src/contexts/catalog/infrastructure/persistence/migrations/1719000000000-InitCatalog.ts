import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitCatalog1719000000000 implements MigrationInterface {
  name = 'InitCatalog1719000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "markets" (` +
        `"id" varchar PRIMARY KEY, "name" varchar NOT NULL, ` +
        `"game" varchar NOT NULL, ` +
        `"outcomes" jsonb NOT NULL DEFAULT '[]'::jsonb);`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "markets";`);
  }
}
