import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitMatchLinks1719200000000 implements MigrationInterface {
  name = 'InitMatchLinks1719200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "match_links" (` +
        `"matchId" varchar PRIMARY KEY, "marketId" varchar, ` +
        `"outcomes" jsonb NOT NULL DEFAULT '[]'::jsonb, ` +
        `"mapping" jsonb NOT NULL DEFAULT '{}'::jsonb, ` +
        `"region" varchar, "league" varchar, "startTime" varchar);`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "match_links";`);
  }
}
