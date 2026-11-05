import { describe, expect, test } from 'vitest';
import type { RotationResult } from '../../src/repositories/refreshTokenRepository';
import {
  AuthService,
  hashToken,
  InvalidRefreshTokenError,
  REFRESH_TOKEN_TTL_MS,
} from '../../src/services/authService';

const NOW = new Date('2030-01-01T00:00:00Z');

function setup(rotation: RotationResult = { status: 'invalid' }) {
  const created: {
    tokenHash: string;
    principal: { type: 'customer' | 'staff'; id: number };
    familyId: string;
    expiresAt: Date;
  }[] = [];
  const rotated: [string, string, Date][] = [];
  const revoked: [string, Date][] = [];

  const service = new AuthService(
    {
      sign: async (principal) =>
        `access-for-${typeof principal === 'number' ? principal : principal.id}`,
    },
    {
      create: async (data) => {
        created.push(data);
      },
      rotate: async (oldHash, newHash, now) => {
        rotated.push([oldHash, newHash, now]);
        return rotation;
      },
      revokeFamily: async (tokenHash, now) => {
        revoked.push([tokenHash, now]);
      },
    },
    () => NOW,
  );

  return { service, created, rotated, revoked };
}

describe('AuthService.startSession', () => {
  test('stores only the hash of a random refresh token with a 7-day expiry', async () => {
    const { service, created } = setup();

    const tokens = await service.startSession(7);

    expect(tokens.accessToken).toBe('access-for-7');
    expect(tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.refreshExpiresAt).toEqual(
      new Date(NOW.getTime() + REFRESH_TOKEN_TTL_MS),
    );
    expect(created).toEqual([
      {
        tokenHash: hashToken(tokens.refreshToken),
        principal: { type: 'customer', id: 7 },
        familyId: expect.any(String),
        expiresAt: tokens.refreshExpiresAt,
      },
    ]);
    expect(created[0]?.tokenHash).not.toBe(tokens.refreshToken);
  });

  test('gives each login a new refresh token and family', async () => {
    const { service, created } = setup();

    const first = await service.startSession(7);
    const second = await service.startSession(7);

    expect(first.refreshToken).not.toBe(second.refreshToken);
    expect(created[0]?.familyId).not.toBe(created[1]?.familyId);
  });

  test('stores staff identity separately from a customer identity', async () => {
    const { service, created } = setup();

    await service.startSession({ type: 'staff', id: 7 });

    expect(created[0]).toMatchObject({
      principal: { type: 'staff', id: 7 },
    });
  });
});

describe('AuthService.refresh', () => {
  test('rotates to a new refresh token and keeps the original expiry', async () => {
    const expiresAt = new Date('2030-01-05T00:00:00Z');
    const { service, rotated } = setup({
      status: 'rotated',
      principal: { type: 'customer', id: 7 },
      expiresAt,
    });

    const tokens = await service.refresh('old-token');

    expect(tokens.accessToken).toBe('access-for-7');
    expect(tokens.refreshToken).not.toBe('old-token');
    expect(tokens.refreshExpiresAt).toBe(expiresAt);
    expect(rotated).toEqual([
      [hashToken('old-token'), hashToken(tokens.refreshToken), NOW],
    ]);
  });

  test.each([{ status: 'invalid' }, { status: 'reused' }] as const)(
    'throws when rotation is $status',
    async (rotation) => {
      const { service } = setup(rotation);

      await expect(service.refresh('token')).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
    },
  );
});

describe('AuthService.logout', () => {
  test('revokes the family by token hash', async () => {
    const { service, revoked } = setup();

    await service.logout('current-token');

    expect(revoked).toEqual([[hashToken('current-token'), NOW]]);
  });
});
