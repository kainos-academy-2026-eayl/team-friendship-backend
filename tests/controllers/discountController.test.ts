import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { DiscountController } from '../../src/controllers/discountController';
import {
  calculateDiscount,
  type Discount,
  type DiscountCodeRecord,
  isUsable,
  normaliseCode,
} from '../../src/models/discountModel';
import { DiscountCodeRepository } from '../../src/repositories/discountCodeRepository';

const NOW = new Date('2026-11-06T12:00:00Z');

function record(
  overrides: Partial<DiscountCodeRecord> = {},
): DiscountCodeRecord {
  return {
    id: 1,
    code: 'FRIENDSHIP12',
    discount: 12,
    status: 'ACTIVE',
    expiryDate: null,
    ...overrides,
  };
}

async function startServer(
  findUsableByCode = vi.fn(
    async (_code: string): Promise<Discount | null> => ({
      id: 1,
      code: 'FRIENDSHIP12',
      percentOff: 12,
    }),
  ),
) {
  const app = express();
  app.use('/', new DiscountController({ findUsableByCode }).router());
  const server = app.listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    get: (code: string) =>
      fetch(`http://127.0.0.1:${port}/discounts/${encodeURIComponent(code)}`),
    findUsableByCode,
  };
}

describe('normaliseCode', () => {
  test.each([
    ['friendship12', 'FRIENDSHIP12'],
    ['  Friendship12 ', 'FRIENDSHIP12'],
  ])('%j becomes %j', (input, expected) => {
    expect(normaliseCode(input)).toBe(expected);
  });
});

describe('isUsable', () => {
  test('accepts an active code with no expiry date', () => {
    expect(isUsable(record(), NOW)).toBe(true);
  });

  test('accepts an active code that has not yet expired', () => {
    expect(
      isUsable(record({ expiryDate: new Date('2026-11-07T00:00:00Z') }), NOW),
    ).toBe(true);
  });

  test.each([
    ['in the past', new Date('2026-11-05T23:59:59Z')],
    ['exactly now', NOW],
  ])('rejects an active code whose expiry date is %s', (_label, expiryDate) => {
    expect(isUsable(record({ expiryDate }), NOW)).toBe(false);
  });

  test.each(['EXPIRED', 'DISABLED'])('rejects a %s code', (status) => {
    expect(isUsable(record({ status }), NOW)).toBe(false);
  });
});

describe('calculateDiscount', () => {
  test.each([
    [179.97, 12, 21.6],
    [100, 12, 12],
    [9.99, 12, 1.2],
    [0, 12, 0],
  ])('%d at %d%% off is %d', (subtotal, percentOff, expected) => {
    expect(calculateDiscount(subtotal, percentOff)).toBe(expected);
  });
});

describe('DiscountCodeRepository.findUsableByCode', () => {
  function repositoryReturning(result: DiscountCodeRecord | null) {
    const findUnique = vi.fn(async () => result);
    const repository = new DiscountCodeRepository({
      discountCode: { findUnique },
    } as unknown as ConstructorParameters<typeof DiscountCodeRepository>[0]);
    return { repository, findUnique };
  }

  test('looks the code up in upper case and returns the discount', async () => {
    const { repository, findUnique } = repositoryReturning(record());

    await expect(
      repository.findUsableByCode(' friendship12 ', NOW),
    ).resolves.toEqual({ id: 1, code: 'FRIENDSHIP12', percentOff: 12 });
    expect(findUnique).toHaveBeenCalledWith({
      where: { code: 'FRIENDSHIP12' },
    });
  });

  test('returns null for an unknown code', async () => {
    const { repository } = repositoryReturning(null);

    await expect(repository.findUsableByCode('NOPE', NOW)).resolves.toBeNull();
  });

  test('returns null for a disabled code', async () => {
    const { repository } = repositoryReturning(record({ status: 'DISABLED' }));

    await expect(
      repository.findUsableByCode('FRIENDSHIP12', NOW),
    ).resolves.toBeNull();
  });

  test.each(['', '   ', 'X'.repeat(51)])(
    'does not query the database for %j',
    async (code) => {
      const { repository, findUnique } = repositoryReturning(record());

      await expect(repository.findUsableByCode(code, NOW)).resolves.toBeNull();
      expect(findUnique).not.toHaveBeenCalled();
    },
  );
});

describe('GET /discounts/:code', () => {
  test('returns the code and percentage for a usable code', async () => {
    const { get, findUsableByCode } = await startServer();

    const response = await get('friendship12');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      discount: { code: 'FRIENDSHIP12', percentOff: 12 },
    });
    expect(findUsableByCode).toHaveBeenCalledWith('friendship12');
  });

  test('returns 404 when the code cannot be used', async () => {
    const { get } = await startServer(vi.fn(async () => null));

    const response = await get('NOPE');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Invalid discount code' });
  });

  test('returns 500 when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { get } = await startServer(
      vi.fn(async () => {
        throw new Error('db down');
      }),
    );

    const response = await get('FRIENDSHIP12');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });
});
