import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitWalletOperations1718700000000 implements MigrationInterface {
  name = 'InitWalletOperations1718700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "wallet_operations" (` +
        `"opKey" varchar PRIMARY KEY, "userId" varchar NOT NULL, ` +
        `"amount" numeric(14,2) NOT NULL, "kind" varchar NOT NULL, ` +
        `"createdAt" timestamptz NOT NULL DEFAULT now());`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_operations";`);
  }
}
