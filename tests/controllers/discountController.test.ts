import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, onTestFinished, test } from 'vitest';
import { DiscountController } from '../../src/controllers/discountController';
import {
  calculateDiscount,
  findDiscount,
} from '../../src/models/discountModel';

async function startServer() {
  const app = express();
  app.use('/', new DiscountController().router());
  const server = app.listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return (code: string) =>
    fetch(`http://127.0.0.1:${port}/discounts/${encodeURIComponent(code)}`);
}

describe('findDiscount', () => {
  test.each(['FRIENDSHIP12', 'friendship12', '  Friendship12 '])(
    'recognises %j',
    (code) => {
      expect(findDiscount(code)).toEqual({
        code: 'FRIENDSHIP12',
        percentOff: 12,
      });
    },
  );

  test.each(['', 'FRIENDSHIP', 'FRIENDSHIP120', 'FRIEND SHIP12'])(
    'rejects %j',
    (code) => {
      expect(findDiscount(code)).toBeUndefined();
    },
  );
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

describe('GET /discounts/:code', () => {
  test('returns the discount for a valid code', async () => {
    const get = await startServer();

    const response = await get('friendship12');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      discount: { code: 'FRIENDSHIP12', percentOff: 12 },
    });
  });

  test('returns 404 for an unknown code', async () => {
    const get = await startServer();

    const response = await get('NOPE');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Invalid discount code' });
  });
});
