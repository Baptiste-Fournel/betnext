import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitCompliance1718900000000 implements MigrationInterface {
  name = 'InitCompliance1718900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "rg_caps" ("userId" varchar PRIMARY KEY, "dailyCap" numeric(14,2) NOT NULL);`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "rg_daily_stakes" (` +
        `"userId" varchar NOT NULL, "day" varchar NOT NULL, ` +
        `"staked" numeric(14,2) NOT NULL DEFAULT 0, PRIMARY KEY ("userId", "day"));`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rg_daily_stakes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rg_caps";`);
  }
}
