import { DataSource } from 'typeorm';
import { StoredUser, UserStore } from '../../application/ports/UserStore';
import { Role } from '../../domain/Role';
import { UserRecord } from './UserRecord';

/** Store Postgres des comptes. L'unicité du username est garantie par l'index unique (base). */
export class TypeOrmUserStore implements UserStore {
  constructor(private readonly dataSource: DataSource) {}

  async findByUsername(username: string): Promise<StoredUser | null> {
    const row = await this.dataSource.getRepository(UserRecord).findOne({ where: { username } });
    return row
      ? {
          id: row.id,
          username: row.username,
          passwordHash: row.passwordHash,
          role: row.role as Role,
        }
      : null;
  }

  async create(user: StoredUser): Promise<void> {
    // INSERT simple : une violation de l'index unique (username repris) remonte en erreur.
    await this.dataSource.getRepository(UserRecord).insert(user);
  }
}
