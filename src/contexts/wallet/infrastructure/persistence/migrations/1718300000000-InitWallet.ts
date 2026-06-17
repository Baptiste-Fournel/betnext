import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitWallet1718300000000 implements MigrationInterface {
  name = 'InitWallet1718300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "wallets" ("userId" varchar PRIMARY KEY, "balance" numeric(14,2) NOT NULL DEFAULT 0);`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets";`);
  }
}
