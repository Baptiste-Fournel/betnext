import { DomainError } from '../../../shared-kernel/domain/DomainError';
import { Role } from '../domain/Role';
import { PasswordHasher } from './ports/PasswordHasher';
import { TokenService } from './ports/TokenService';
import { UserStore } from './ports/UserStore';

export interface LoginInput {
  username: string;
  password: string;
}
export interface LoginResult {
  userId: string;
  role: Role;
  token: string;
  expiresInSec: number;
}

export class LoginUser {
  constructor(
    private readonly users: UserStore,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const username = input.username?.trim() ?? '';
    const password = typeof input.password === 'string' ? input.password : '';
    const user = await this.users.findByUsername(username);
    const ok = user ? await this.hasher.verify(password, user.passwordHash) : false;
    if (!user || !ok) {
      throw new DomainError('Identifiants invalides', 401);
    }
    const issued = this.tokens.sign({ userId: user.id, role: user.role });
    return {
      userId: user.id,
      role: user.role,
      token: issued.token,
      expiresInSec: issued.expiresInSec,
    };
  }
}
