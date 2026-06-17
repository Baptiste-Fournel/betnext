import { StoredUser, UserStore } from '../application/ports/UserStore';

/** Store en mémoire (mode sans DATABASE_URL / tests). Unicité du username comme en base. */
export class InMemoryUserStore implements UserStore {
  private readonly byUsername = new Map<string, StoredUser>();

  async findByUsername(username: string): Promise<StoredUser | null> {
    return this.byUsername.get(username) ?? null;
  }

  async create(user: StoredUser): Promise<void> {
    if (this.byUsername.has(user.username)) {
      throw new Error('username already exists');
    }
    this.byUsername.set(user.username, { ...user });
  }
}
