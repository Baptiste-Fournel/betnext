import { HmacTokenService } from './HmacTokenService';

describe('HmacTokenService (BET-20) — tamper-proof token', () => {
  const svc = new HmacTokenService('test-secret-abc', 3600);

  it('shouldRoundTripPayloadAndExpiry_WhenSigningThenVerifying', () => {
    // Act
    const { token, expiresInSec } = svc.sign({ userId: 'u1', role: 'PLAYER' });

    // Assert
    expect(expiresInSec).toBe(3600);
    expect(svc.verify(token)).toEqual({ userId: 'u1', role: 'PLAYER' });
  });

  it('shouldReturnNull_WhenSignatureTampered', () => {
    // Arrange
    const { token } = svc.sign({ userId: 'u1', role: 'PLAYER' });
    const [h, p] = token.split('.');

    // Act / Assert
    expect(svc.verify(`${h}.${p}.deadbeef`)).toBeNull();
  });

  it('shouldReturnNull_WhenRoleEscalatedWithStalePayloadAndOldSignature', () => {
    // Arrange
    const { token } = svc.sign({ userId: 'u1', role: 'PLAYER' });
    const [h, , s] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'u1', role: 'MANAGER', exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');

    // Act / Assert
    expect(svc.verify(`${h}.${forged}.${s}`)).toBeNull();
  });

  it('shouldReturnNull_WhenAlgNoneOrSignatureMissing', () => {
    // Arrange
    const { token } = svc.sign({ userId: 'u1', role: 'PLAYER' });
    const [h, p] = token.split('.');

    // Act / Assert
    expect(svc.verify(`${h}.${p}.`)).toBeNull();
    expect(svc.verify(`${h}.${p}`)).toBeNull();
  });

  it('shouldReturnNull_WhenTokenSignedWithDifferentSecret', () => {
    // Arrange
    const other = new HmacTokenService('un-autre-secret', 3600);

    // Act / Assert
    expect(svc.verify(other.sign({ userId: 'u1', role: 'PLAYER' }).token)).toBeNull();
  });

  it('shouldReturnNull_WhenTokenExpired', () => {
    // Arrange
    const expired = new HmacTokenService('test-secret-abc', -10);

    // Act / Assert
    expect(svc.verify(expired.sign({ userId: 'u1', role: 'PLAYER' }).token)).toBeNull();
  });

  it('shouldThrow_WhenSecretEmptyAtConstruction', () => {
    // Act / Assert
    expect(() => new HmacTokenService('')).toThrow();
  });
});
