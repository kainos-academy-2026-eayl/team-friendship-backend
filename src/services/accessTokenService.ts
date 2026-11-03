import { jwtVerify, SignJWT } from 'jose';

const ACCESS_TOKEN_TTL = '15m';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const ALGORITHM = 'HS256';
const ISSUER = 'team-friendship-backend';
const AUDIENCE = 'team-friendship-frontend';

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

  sign(customerId: number): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(String(customerId))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.secret);
  }

  async verify(token: string): Promise<number> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: [ALGORITHM],
        issuer: ISSUER,
        audience: AUDIENCE,
        requiredClaims: ['sub', 'exp'],
      });
      const customerId = Number(payload.sub);
      if (!Number.isSafeInteger(customerId) || customerId <= 0) {
        throw new InvalidAccessTokenError();
      }
      return customerId;
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}
