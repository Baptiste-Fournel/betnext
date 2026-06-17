import { ScryptPasswordHasher } from './ScryptPasswordHasher';

describe('ScryptPasswordHasher (BET-20)', () => {
  const hasher = new ScryptPasswordHasher();

  it('hache (jamais le clair) et vérifie le bon mot de passe', async () => {
    const hash = await hasher.hash('changeme123');
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(hash).not.toContain('changeme123');
    expect(await hasher.verify('changeme123', hash)).toBe(true);
  });

  it('rejette un mauvais mot de passe', async () => {
    const hash = await hasher.hash('changeme123');
    expect(await hasher.verify('mauvais', hash)).toBe(false);
  });

  it('sel aléatoire : deux hash diffèrent pour le même mot de passe', async () => {
    expect(await hasher.hash('x12345678')).not.toBe(await hasher.hash('x12345678'));
  });

  it('refuse un hash stocké dégénéré → aucun bypass (B1)', async () => {
    for (const bad of [
      'scrypt$abcd$',
      'scrypt$$',
      'scrypt$zz$zz',
      'scrypt$$',
      'bcrypt$a$b',
      'n.importe',
    ]) {
      expect(await hasher.verify('peu importe', bad)).toBe(false);
    }
  });
});
