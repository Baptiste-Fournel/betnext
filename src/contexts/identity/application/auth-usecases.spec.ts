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
  it('hache le mot de passe (jamais le clair) et crée le compte', async () => {
    const store = fakeStore();
    const res = await new RegisterUser(store, fakeHasher, ids).execute({
      username: 'alice',
      password: 'password1',
    });
    expect(res).toEqual({ id: 'id-1', username: 'alice', role: 'PLAYER' }); // rôle PLAYER imposé par le use-case
    expect(store.rows.get('alice')?.passwordHash).toBe('H(password1)');
  });

  it('refuse un mot de passe trop court', async () => {
    await expect(
      new RegisterUser(fakeStore(), fakeHasher, ids).execute({
        username: 'a',
        password: 'court',
      }),
    ).rejects.toThrow();
  });

  it('refuse un username déjà pris', async () => {
    const store = fakeStore();
    const uc = new RegisterUser(store, fakeHasher, ids);
    await uc.execute({ username: 'bob', password: 'password1' });
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

  it('émet un token pour des identifiants valides', async () => {
    const res = await new LoginUser(seeded(), fakeHasher, fakeTokens).execute({
      username: 'alice',
      password: 'password1',
    });
    expect(res).toMatchObject({ userId: 'id-1', role: 'PLAYER', token: 'tok' });
  });

  it('mauvais mot de passe ET utilisateur inconnu → MÊME message 401 (pas d’énumération)', async () => {
    const wrongPass = new LoginUser(seeded(), fakeHasher, fakeTokens).execute({
      username: 'alice',
      password: 'nope',
    });
    const unknown = new LoginUser(seeded(), fakeHasher, fakeTokens).execute({
      username: 'ghost',
      password: 'x',
    });
    await expect(wrongPass).rejects.toThrow('Identifiants invalides');
    await expect(unknown).rejects.toThrow('Identifiants invalides');
  });
});
