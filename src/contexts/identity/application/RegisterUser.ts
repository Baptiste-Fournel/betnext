import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { Role } from '../domain/Role';
import { IdGenerator } from './ports/IdGenerator';
import { PasswordHasher } from './ports/PasswordHasher';
import { StoredUser, UserStore } from './ports/UserStore';

export interface RegisterInput {
  username: string;
  password: string;
}
export interface RegisterResult {
  id: string;
  username: string;
  role: Role;
}

export class RegisterUser {
  private static readonly SELF_REGISTER_ROLE: Role = 'PLAYER';

  constructor(
    private readonly users: UserStore,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const username = input.username?.trim();
    if (!username) {
      throw new DomainError('username requis');
    }
    if (typeof input.password !== 'string' || input.password.length < 8) {
      throw new DomainError('mot de passe trop court (8 caractères minimum)');
    }
    if (await this.users.findByUsername(username)) {
      throw new DomainError("Nom d'utilisateur déjà pris", 409);
    }
    const user: StoredUser = {
      id: this.ids.next(),
      username,
      passwordHash: await this.hasher.hash(input.password),
      role: RegisterUser.SELF_REGISTER_ROLE,
    };
    await this.users.create(user);
    return { id: user.id, username: user.username, role: user.role };
  }
}
