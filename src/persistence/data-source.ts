import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ENTITIES, MIGRATIONS } from './schema';

/**
 * DataSource du CLI TypeORM (`migration:run`/`migration:revert`). Schéma = SOURCE UNIQUE `schema.ts`
 * (mêmes entités/migrations que le runtime). `DATABASE_URL` via env ; défaut = Postgres local du
 * `docker-compose` (identifiants de DEV, pas un secret) pour que les commandes CLI marchent
 * out-of-the-box. Pool configurable via `DB_POOL_SIZE`.
 */
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
