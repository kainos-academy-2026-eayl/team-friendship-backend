import { describe, expect, test, vi } from 'vitest';
import type {
  PrismaClient,
  RefreshToken,
} from '../../src/generated/prisma/client';
import { RefreshTokenRepository } from '../../src/repositories/refreshTokenRepository';

const NOW = new Date('2030-01-01T00:00:00Z');

function token(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'token-1',
    tokenHash: 'old-hash',
    familyId: 'family-1',
    customerID: 7,
    staffID: null,
    expiresAt: new Date('2030-01-05T00:00:00Z'),
    revokedAt: null,
    replacedById: null,
    createdAt: new Date('2029-12-29T00:00:00Z'),
    ...overrides,
  };
}

// Records every database call in order so tests can assert the lock is taken before reads and writes that depend on it.
function setup(found: RefreshToken | null, underLock = found) {
  const log: string[] = [];
  let locked = false;
  const tx = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values) => {
      log.push(`lock:${values.join(',')}`);
      expect(strings.join('?')).toContain(
        'pg_advisory_xact_lock(hashtextextended(?, 0))',
      );
      locked = true;
      return [{ locked: 1 }];
    }),
    refreshToken: {
      findUnique: vi.fn(async () => {
        log.push('findUnique');
        return found;
      }),
      findUniqueOrThrow: vi.fn(async () => {
        log.push(`findUniqueOrThrow:${locked ? 'locked' : 'unlocked'}`);
        return underLock;
      }),
      create: vi.fn(async ({ data }) => {
        log.push(`create:${locked ? 'locked' : 'unlocked'}`);
        return { ...token(), ...data, id: 'token-2' };
      }),
      update: vi.fn(async () => {
        log.push(`update:${locked ? 'locked' : 'unlocked'}`);
      }),
      updateMany: vi.fn(async () => {
        log.push(`updateMany:${locked ? 'locked' : 'unlocked'}`);
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const repository = new RefreshTokenRepository(
    prisma as unknown as PrismaClient,
  );
  return { repository, tx, prisma, log };
}

describe('RefreshTokenRepository.rotate', () => {
  test('locks the family before re-reading and replacing the token', async () => {
    const { repository, tx, log } = setup(token());

    const result = await repository.rotate('old-hash', 'new-hash', NOW);

    expect(result).toEqual({
      status: 'rotated',
      principal: { type: 'customer', id: 7 },
      expiresAt: new Date('2030-01-05T00:00:00Z'),
    });
    expect(log).toEqual([
      'findUnique',
      'lock:family-1',
      'findUniqueOrThrow:locked',
      'create:locked',
      'update:locked',
    ]);
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: {
        tokenHash: 'new-hash',
        customerID: 7,
        staffID: null,
        familyId: 'family-1',
        expiresAt: new Date('2030-01-05T00:00:00Z'),
      },
    });

    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { revokedAt: NOW, replacedById: 'token-2' },
    });
  });

  test('preserves staff identity when rotating staff refresh tokens', async () => {
    const staffToken = token({ customerID: null, staffID: 7 });
    const { repository, tx } = setup(staffToken);

    await expect(
      repository.rotate('old-hash', 'new-hash', NOW),
    ).resolves.toMatchObject({
      status: 'rotated',
      principal: { type: 'staff', id: 7 },
    });
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: {
        tokenHash: 'new-hash',
        customerID: null,
        staffID: 7,
        familyId: 'family-1',
        expiresAt: staffToken.expiresAt,
      },
    });
  });

  test('treats a token revoked by a concurrent transaction as reuse and revokes the family under the lock', async () => {
    const { repository, tx, log } = setup(
      token(),
      token({ revokedAt: new Date('2029-12-31T00:00:00Z') }),
    );

    const result = await repository.rotate('old-hash', 'new-hash', NOW);

    expect(result).toEqual({ status: 'reused' });
    expect(log).toEqual([
      'findUnique',
      'lock:family-1',
      'findUniqueOrThrow:locked',
      'updateMany:locked',
    ]);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: NOW },
    });
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  test('returns invalid for an expired token without replacing it', async () => {
    const expired = token({ expiresAt: NOW });
    const { repository, tx } = setup(expired);

    await expect(
      repository.rotate('old-hash', 'new-hash', NOW),
    ).resolves.toEqual({ status: 'invalid' });
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(tx.refreshToken.update).not.toHaveBeenCalled();
  });

  test('returns invalid for an unknown token without locking', async () => {
    const { repository, tx } = setup(null);

    await expect(
      repository.rotate('unknown', 'new-hash', NOW),
    ).resolves.toEqual({ status: 'invalid' });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('RefreshTokenRepository.revokeFamily', () => {
  test('revokes the family inside a transaction while holding the family lock', async () => {
    const { repository, prisma, tx, log } = setup(token());

    await repository.revokeFamily('old-hash', NOW);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(log).toEqual(['findUnique', 'lock:family-1', 'updateMany:locked']);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: NOW },
    });
  });

  test('does nothing for an unknown token', async () => {
    const { repository, tx } = setup(null);

    await repository.revokeFamily('unknown', NOW);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
