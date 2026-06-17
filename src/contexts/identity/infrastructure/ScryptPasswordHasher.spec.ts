import { ScryptPasswordHasher } from './ScryptPasswordHasher';

describe('ScryptPasswordHasher (BET-20)', () => {
  const hasher = new ScryptPasswordHasher();

  it('shouldHashNeverPlaintextAndVerifyCorrectPassword_WhenHashing', async () => {
    // Arrange
    const hash = await hasher.hash('changeme123');

    // Act / Assert
    expect(hash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(hash).not.toContain('changeme123');
    expect(await hasher.verify('changeme123', hash)).toBe(true);
  });

  it('shouldReturnFalse_WhenVerifyingWrongPassword', async () => {
    // Arrange
    const hash = await hasher.hash('changeme123');

    // Act / Assert
    expect(await hasher.verify('mauvais', hash)).toBe(false);
  });

  it('shouldProduceDifferentHashes_WhenHashingSamePasswordTwice', async () => {
    // Act / Assert
    expect(await hasher.hash('x12345678')).not.toBe(await hasher.hash('x12345678'));
  });

  it('shouldReturnFalseNeverBypass_WhenStoredHashDegenerate', async () => {
    // Arrange
    const degenerate = [
      'scrypt$abcd$',
      'scrypt$$',
      'scrypt$zz$zz',
      'scrypt$$',
      'bcrypt$a$b',
      'n.importe',
    ];

    // Act / Assert
    for (const bad of degenerate) {
      expect(await hasher.verify('peu importe', bad)).toBe(false);
    }
  });
});
