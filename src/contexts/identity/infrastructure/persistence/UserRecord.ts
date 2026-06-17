import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Role } from '../../domain/Role';

/** Compte utilisateur (contexte Identity). `username` unique ; seul le HASH du mot de passe est stocké. */
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
