import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BetRecord } from '../contexts/betting/infrastructure/persistence/BetRecord';
import { BetEventRecord } from '../contexts/betting/infrastructure/persistence/BetEventRecord';
import { InitBetting1718200000000 } from '../contexts/betting/infrastructure/persistence/migrations/1718200000000-InitBetting';

/**
 * DataSource du CLI TypeORM (migration:run/revert). DATABASE_URL par défaut = POC local,
 * NON tranché — à overrider en environnement.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://betnext:betnext@localhost:5432/betnext',
  entities: [BetRecord, BetEventRecord],
  migrations: [InitBetting1718200000000],
  synchronize: false,
});

export default AppDataSource;
