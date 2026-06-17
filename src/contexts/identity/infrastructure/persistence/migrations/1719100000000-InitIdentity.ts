import { MigrationInterface, QueryRunner } from 'typeorm';

/** Crée la table `users` (contexte Identity) + l'unicité du username. Idempotente. */
export class InitIdentity1719100000000 implements MigrationInterface {
  name = 'InitIdentity1719100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" (` +
        `"id" varchar PRIMARY KEY, "username" varchar NOT NULL, ` +
        `"passwordHash" varchar NOT NULL, "role" varchar NOT NULL, ` +
        `"createdAt" timestamptz NOT NULL DEFAULT now());`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_users_username" ON "users" ("username");`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_users_username";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
