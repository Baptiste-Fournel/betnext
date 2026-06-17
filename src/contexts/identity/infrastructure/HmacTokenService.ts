import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  AuthRole,
  TokenVerifierPort,
  VerifiedToken,
} from '../../../shared-kernel/ports/TokenVerifierPort';
import { IssuedToken, TokenService } from '../application/ports/TokenService';
import { Role } from '../domain/Role';

const b64urlJson = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString('base64url');

export class HmacTokenService implements TokenService, TokenVerifierPort {
  private readonly header = b64urlJson({ alg: 'HS256', typ: 'JWT' });

  constructor(
    private readonly secret: string,
    private readonly ttlSec = 3600,
  ) {
    if (!secret) {
      throw new Error('AUTH_SECRET requis pour signer/vérifier les tokens');
    }
  }

  sign(input: { userId: string; role: Role }): IssuedToken {
    const now = Math.floor(Date.now() / 1000);
    const payload = b64urlJson({
      sub: input.userId,
      role: input.role,
      iat: now,
      exp: now + this.ttlSec,
    });
    const signingInput = `${this.header}.${payload}`;
    return { token: `${signingInput}.${this.signature(signingInput)}`, expiresInSec: this.ttlSec };
  }

  verify(token: string): VerifiedToken | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const [header, payload, sig] = parts;
    if (!this.safeEqual(sig, this.signature(`${header}.${payload}`))) {
      return null;
    }
    let decoded: { sub?: unknown; role?: unknown; exp?: unknown };
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
    const { sub, role, exp } = decoded;
    if (typeof sub !== 'string' || (role !== 'PLAYER' && role !== 'MANAGER')) {
      return null;
    }
    if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { userId: sub, role: role as AuthRole };
  }

  private signature(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('base64url');
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }
}
