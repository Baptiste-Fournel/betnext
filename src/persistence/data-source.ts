import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ENTITIES, MIGRATIONS } from './schema';

const DEV_LOCAL_URL = 'postgres://betnext:betnext@localhost:5432/betnext';
const requested = Number(process.env.DB_POOL_SIZE ?? 10);
const poolSize = Number.isFinite(requested) && requested > 0 ? requested : 10;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? DEV_LOCAL_URL,
  entities: ENTITIES,
  migrations: MIGRATIONS,
  synchronize: false,
  poolSize,
});

export default AppDataSource;
