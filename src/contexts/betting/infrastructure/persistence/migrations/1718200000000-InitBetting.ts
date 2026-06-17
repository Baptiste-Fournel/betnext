import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitBetting1718200000000 implements MigrationInterface {
  name = 'InitBetting1718200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bets" (
        "id" varchar PRIMARY KEY,
        "userId" varchar NOT NULL,
        "outcomeId" varchar NOT NULL,
        "stake" numeric(14,2) NOT NULL,
        "lockedOdds" numeric(6,2) NOT NULL,
        "potentialGain" numeric(14,2) NOT NULL,
        "status" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bet_events" (
        "seq" bigserial PRIMARY KEY,
        "betId" varchar NOT NULL,
        "type" varchar NOT NULL,
        "version" int NOT NULL DEFAULT 1,
        "payload" text NOT NULL,
        "occurredAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bet_events_betId" ON "bet_events" ("betId");`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "betnext_bet_events_append_only"() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'bet_events is append-only'; END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "bet_events_no_mutation" ON "bet_events";`);
    await queryRunner.query(`
      CREATE TRIGGER "bet_events_no_mutation" BEFORE UPDATE OR DELETE ON "bet_events"
      FOR EACH ROW EXECUTE FUNCTION "betnext_bet_events_append_only"();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "bet_events_no_mutation" ON "bet_events";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "betnext_bet_events_append_only"();`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bet_events";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bets";`);
  }
}
