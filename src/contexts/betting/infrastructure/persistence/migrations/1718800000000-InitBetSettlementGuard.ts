import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitBetSettlementGuard1718800000000 implements MigrationInterface {
  name = 'InitBetSettlementGuard1718800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_bet_settlement_event" ON "bet_events" ("betId") ` +
        `WHERE "type" IN ('BetWon', 'BetLost', 'BetVoided');`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_bet_settlement_event";`);
  }
}
