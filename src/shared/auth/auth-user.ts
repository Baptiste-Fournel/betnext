import { AuthRole } from '../../shared-kernel/ports/TokenVerifierPort';

export interface AuthUser {
  userId: string;
  role: AuthRole;
}
