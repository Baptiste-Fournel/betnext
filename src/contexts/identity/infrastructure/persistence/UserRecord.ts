import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Role } from '../../domain/Role';

@Entity('users')
export class UserRecord {
  @PrimaryColumn('varchar')
  id!: string;

  @Column('varchar', { unique: true })
  username!: string;

  @Column('varchar')
  passwordHash!: string;

  @Column('varchar')
  role!: Role;

  @Column('timestamptz', { default: () => 'now()' })
  createdAt!: Date;
}
