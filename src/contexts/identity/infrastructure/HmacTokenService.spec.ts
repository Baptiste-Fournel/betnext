import { HmacTokenService } from './HmacTokenService';

describe('HmacTokenService (BET-20) — token infalsifiable', () => {
  const svc = new HmacTokenService('test-secret-abc', 3600);

  it('sign/verify : aller-retour valide', () => {
    const { token, expiresInSec } = svc.sign({ userId: 'u1', role: 'PLAYER' });
    expect(expiresInSec).toBe(3600);
    expect(svc.verify(token)).toEqual({ userId: 'u1', role: 'PLAYER' });
  });

  it('rejette une signature falsifiée', () => {
    const { token } = svc.sign({ userId: 'u1', role: 'PLAYER' });
    const [h, p] = token.split('.');
    expect(svc.verify(`${h}.${p}.deadbeef`)).toBeNull();
  });

  it('rejette une escalade de rôle (payload altéré, ancienne signature)', () => {
    const { token } = svc.sign({ userId: 'u1', role: 'PLAYER' });
    const [h, , s] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'u1', role: 'MANAGER', exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    expect(svc.verify(`${h}.${forged}.${s}`)).toBeNull();
  });

  it('rejette alg:none / signature absente', () => {
    const { token } = svc.sign({ userId: 'u1', role: 'PLAYER' });
    const [h, p] = token.split('.');
    expect(svc.verify(`${h}.${p}.`)).toBeNull();
    expect(svc.verify(`${h}.${p}`)).toBeNull();
  });

  it('rejette un token signé par un AUTRE secret', () => {
    const other = new HmacTokenService('un-autre-secret', 3600);
    expect(svc.verify(other.sign({ userId: 'u1', role: 'PLAYER' }).token)).toBeNull();
  });

  it('rejette un token expiré', () => {
    const expired = new HmacTokenService('test-secret-abc', -10); // exp dans le passé, même secret
    expect(svc.verify(expired.sign({ userId: 'u1', role: 'PLAYER' }).token)).toBeNull();
  });

  it('refuse un secret vide à la construction', () => {
    expect(() => new HmacTokenService('')).toThrow();
  });
});
