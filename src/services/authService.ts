import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RefreshTokenRepository } from '../repositories/refreshTokenRepository';
import type { AccessTokenService, AuthPrincipal } from './accessTokenService';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Session expired. Please log in again.');
    this.name = 'InvalidRefreshTokenError';
  }
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
};

type AccessTokenSigner = Pick<AccessTokenService, 'sign'>;
type RefreshTokenStore = Pick<
  RefreshTokenRepository,
  'create' | 'rotate' | 'revokeFamily'
>;

function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

// SHA-256 (not argon2) is fine here: the input is 256 random bits, so it can't be brute-forced.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  constructor(
    private readonly accessTokens: AccessTokenSigner,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async startSession(principal: AuthPrincipal | number): Promise<AuthTokens> {
    const identity =
      typeof principal === 'number'
        ? { type: 'customer' as const, id: principal }
        : principal;
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = new Date(
      this.now().getTime() + REFRESH_TOKEN_TTL_MS,
    );

    await this.refreshTokens.create({
      tokenHash: hashToken(refreshToken),
      principal: identity,
      familyId: randomUUID(),
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken: await this.accessTokens.sign(identity),
      refreshToken,
      refreshExpiresAt,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const nextRefreshToken = generateRefreshToken();
    const result = await this.refreshTokens.rotate(
      hashToken(refreshToken),
      hashToken(nextRefreshToken),
      this.now(),
    );

    if (result.status !== 'rotated') {
      throw new InvalidRefreshTokenError();
    }

    return {
      accessToken: await this.accessTokens.sign(result.principal),
      refreshToken: nextRefreshToken,
      refreshExpiresAt: result.expiresAt,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.revokeFamily(hashToken(refreshToken), this.now());
  }
}
