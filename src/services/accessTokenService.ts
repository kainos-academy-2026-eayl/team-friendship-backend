import { jwtVerify, SignJWT } from 'jose';

const ACCESS_TOKEN_TTL = '15m';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const ALGORITHM = 'HS256';
const ISSUER = 'team-friendship-backend';
const AUDIENCE = 'team-friendship-frontend';

export type AuthPrincipal = {
  type: 'customer' | 'staff';
  id: number;
};

export class InvalidAccessTokenError extends Error {
  constructor() {
    super('Invalid or expired access token');
    this.name = 'InvalidAccessTokenError';
  }
}

export class AccessTokenService {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    if (Buffer.byteLength(secret) < 32) {
      throw new Error('JWT_ACCESS_SECRET must be at least 32 bytes');
    }
    this.secret = new TextEncoder().encode(secret);
  }

  sign(principal: AuthPrincipal | number): Promise<string> {
    const identity =
      typeof principal === 'number'
        ? { type: 'customer' as const, id: principal }
        : principal;
    return new SignJWT({ principalType: identity.type })
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(String(identity.id))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.secret);
  }

  async verify(token: string): Promise<AuthPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
        requiredClaims: ['sub', 'exp'],
      });
      const id = Number(payload.sub);
      const type = payload.principalType ?? 'customer';
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        (type !== 'customer' && type !== 'staff')
      ) {
        throw new InvalidAccessTokenError();
      }
      return { type, id };
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}
