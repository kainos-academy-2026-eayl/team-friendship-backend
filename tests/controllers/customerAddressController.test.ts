import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { CustomerAddressController } from '../../src/controllers/customerAddressController';
import type { DeliveryAddress } from '../../src/models/orderModel';
import type { AuthPrincipal } from '../../src/services/accessTokenService';

const ADDRESS = { address: '123 Town Street', postcode: 'BT16 AAA' };

async function startServer(
  principal: AuthPrincipal | undefined,
  findByCustomerId = vi.fn(
    async (_id: number): Promise<DeliveryAddress | null> => ADDRESS,
  ),
) {
  const app = express();
  app.use((_req, res, next) => {
    if (principal) {
      res.locals.principal = principal;
    }
    next();
  });
  app.use('/', new CustomerAddressController({ findByCustomerId }).router());
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
    get: () => fetch(`http://127.0.0.1:${port}/customers/me/address`),
    findByCustomerId,
  };
}

describe('GET /customers/me/address', () => {
  test("returns the authenticated customer's saved address", async () => {
    const { get, findByCustomerId } = await startServer({
      type: 'customer',
      id: 4,
    });

    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ address: ADDRESS });
    expect(findByCustomerId).toHaveBeenCalledWith(4);
  });

  test('requires authentication', async () => {
    const { get, findByCustomerId } = await startServer(undefined);

    const response = await get();

    expect(response.status).toBe(401);
    expect(findByCustomerId).not.toHaveBeenCalled();
  });

  test('rejects staff accounts', async () => {
    const { get, findByCustomerId } = await startServer({
      type: 'staff',
      id: 1,
    });

    const response = await get();

    expect(response.status).toBe(403);
    expect(findByCustomerId).not.toHaveBeenCalled();
  });

  test('returns 404 when the customer no longer exists', async () => {
    const { get } = await startServer(
      { type: 'customer', id: 99 },
      vi.fn(async () => null),
    );

    expect((await get()).status).toBe(404);
  });

  test('returns 500 when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { get } = await startServer(
      { type: 'customer', id: 4 },
      vi.fn(async () => {
        throw new Error('db down');
      }),
    );

    const response = await get();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });
});
