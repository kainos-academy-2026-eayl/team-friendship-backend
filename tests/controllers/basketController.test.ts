import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { expect, it, onTestFinished, vi } from 'vitest';
import { BasketController } from '../../src/controllers/basketController';
import { BasketError } from '../../src/models/basketModel';

async function setup(principal?: { type: 'customer' | 'staff'; id: number }) {
  const row = { basketID: 1, customerID: 7, productID: 12, quantity: 2 };
  const service = {
    getBasket: vi.fn(async () => [row]),
    addToBasket: vi.fn(async () => row),
    updateQuantity: vi.fn(async () => row),
    removeFromBasket: vi.fn(async () => row),
  };
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    if (principal) res.locals.principal = principal;
    next();
  });
  app.use(new BasketController(service).router());
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/basket`;
  const send = (method: string, path: string, body: unknown) =>
    fetch(`${url}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { url, send, service };
}

it('uses the verified customer instead of a submitted ID', async () => {
  const { send, service } = await setup({ type: 'customer', id: 7 });
  expect(
    (await send('POST', '', { customerID: 99, productID: 12, quantity: 2 }))
      .status,
  ).toBe(201);
  expect(service.addToBasket).toHaveBeenCalledWith(7, 12, 2);
});

it.each([undefined, { type: 'staff' as const, id: 7 }])(
  'requires a customer principal %j',
  async (principal) => {
    const { send, service } = await setup(principal);
    expect(
      (await send('POST', '', { productID: 12, quantity: 1 })).status,
    ).toBe(principal ? 403 : 401);
    expect(service.addToBasket).not.toHaveBeenCalled();
  },
);

it.each([0, -1, 1.5, '2', 2147483648])(
  'rejects invalid quantities %j',
  async (quantity) => {
    const { send, service } = await setup({ type: 'customer', id: 7 });
    expect((await send('POST', '', { productID: 12, quantity })).status).toBe(
      400,
    );
    expect(service.addToBasket).not.toHaveBeenCalled();
  },
);

it('passes delta updates to the service with the verified customer', async () => {
  const { send, service } = await setup({ type: 'customer', id: 7 });
  const response = await send('PUT', '/1', { change: 1 });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(service.updateQuantity).toHaveBeenCalledWith(7, 1, { change: 1 });
});

it('keeps absolute quantity updates supported', async () => {
  const { send, service } = await setup({ type: 'customer', id: 7 });
  expect((await send('PUT', '/1', { quantity: 3 })).status).toBe(200);
  expect(service.updateQuantity).toHaveBeenCalledWith(7, 1, { quantity: 3 });
});

it('returns stock conflicts explicitly', async () => {
  const { send, service } = await setup({ type: 'customer', id: 7 });
  service.updateQuantity.mockRejectedValue(
    new BasketError(409, 'Stock limit reached.'),
  );
  const response = await send('PUT', '/1', { change: 1 });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Stock limit reached.' });
});

it('cannot read another customer basket', async () => {
  const { url, service } = await setup({ type: 'customer', id: 7 });
  expect((await fetch(`${url}/99`)).status).toBe(403);
  expect(service.getBasket).not.toHaveBeenCalled();
});
