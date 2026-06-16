import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Garde-fou d'immuabilité du journal pour le RÈGLEMENT : au plus UN event terminal par pari.
 * Sous règlement CONCURRENT du même marché, le 2e INSERT (BetWon/Lost/Voided) viole cet index →
 * sa transaction échoue (rollback) → aucun doublon d'event, aucun double-effet. Idempotente.
 */
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
