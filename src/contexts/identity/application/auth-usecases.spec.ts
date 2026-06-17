import { RegisterUser } from './RegisterUser';
import { LoginUser } from './LoginUser';
import { PasswordHasher } from './ports/PasswordHasher';
import { TokenService } from './ports/TokenService';
import { StoredUser, UserStore } from './ports/UserStore';

const fakeStore = (): UserStore & { rows: Map<string, StoredUser> } => {
  const rows = new Map<string, StoredUser>();
  return {
    rows,
    findByUsername: async (u): Promise<StoredUser | null> => rows.get(u) ?? null,
    create: async (user): Promise<void> => {
      if (rows.has(user.username)) throw new Error('dup');
      rows.set(user.username, user);
    },
  };
};
const fakeHasher: PasswordHasher = {
  hash: async (p) => `H(${p})`,
  verify: async (p, h) => h === `H(${p})`,
};
const fakeTokens: TokenService = { sign: () => ({ token: 'tok', expiresInSec: 3600 }) };
const ids = { next: (): string => 'id-1' };

describe('RegisterUser (BET-20)', () => {
  it('shouldHashPasswordNeverPlaintextAndCreatePlayerAccount_WhenRegistering', async () => {
    // Arrange
    const store = fakeStore();

    // Act
    const res = await new RegisterUser(store, fakeHasher, ids).execute({
      username: 'alice',
      password: 'password1',
    });

    // Assert
    expect(res).toEqual({ id: 'id-1', username: 'alice', role: 'PLAYER' });
    expect(store.rows.get('alice')?.passwordHash).toBe('H(password1)');
  });

  it('shouldReject_WhenPasswordTooShort', async () => {
    // Act / Assert
    await expect(
      new RegisterUser(fakeStore(), fakeHasher, ids).execute({
        username: 'a',
        password: 'court',
      }),
    ).rejects.toThrow();
  });

  it('shouldReject_WhenUsernameAlreadyTaken', async () => {
    // Arrange
    const store = fakeStore();
    const uc = new RegisterUser(store, fakeHasher, ids);
    await uc.execute({ username: 'bob', password: 'password1' });

    // Act / Assert
    await expect(uc.execute({ username: 'bob', password: 'password2' })).rejects.toThrow();
  });
});

describe('LoginUser (BET-20)', () => {
  const seeded = (): UserStore => {
    const s = fakeStore();
    s.rows.set('alice', {
      id: 'id-1',
      username: 'alice',
      passwordHash: 'H(password1)',
      role: 'PLAYER',
    });
    return s;
  };

  it('shouldIssueToken_WhenCredentialsValid', async () => {
    // Act
    const res = await new LoginUser(seeded(), fakeHasher, fakeTokens).execute({
      username: 'alice',
      password: 'password1',
    });

    // Assert
    expect(res).toMatchObject({ userId: 'id-1', role: 'PLAYER', token: 'tok' });
  });

  it('shouldRejectWithSameInvalidCredentialsMessage_WhenWrongPasswordOrUnknownUser', async () => {
    // Arrange
    const wrongPass = new LoginUser(seeded(), fakeHasher, fakeTokens).execute({
      username: 'alice',
      password: 'nope',
    });
    const unknown = new LoginUser(seeded(), fakeHasher, fakeTokens).execute({
      username: 'ghost',
      password: 'x',
    });

    // Act / Assert
    await expect(wrongPass).rejects.toThrow('Identifiants invalides');
    await expect(unknown).rejects.toThrow('Identifiants invalides');
  });
});
