import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { AuthController } from '../../src/controllers/authController';
import { OrderHistoryController } from '../../src/controllers/orderHistoryController';
import { AccessTokenService } from '../../src/services/accessTokenService';
import { OrderHistoryService } from '../../src/services/orderHistoryService';

const tokens = new AccessTokenService('a'.repeat(32));

const orders = [
  {
    orderID: 1,
    customerID: 6,
    dateCreated: new Date('2026-11-01T10:00:00Z'),
    status: 'Delivered',
    orderServices: [
      {
        orderID: 1,
        productID: 1,
        quantity: 2,
        product: { productName: 'Bag of Marbles' },
      },
    ],
  },
];

async function startServer(findOrders = vi.fn().mockResolvedValue(orders)) {
  const app = express();
  const authController = new AuthController(tokens);
  const controller = new OrderHistoryController(
    new OrderHistoryService({ findOrderHistoryByCustomerID: findOrders }),
  );
  app.use(authController.requireAuth);
  app.use('/', controller.router());
  const server = app.listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, findOrders };
}

async function get(baseUrl: string, customerId: number, tokenFor: number) {
  const token = await tokens.sign(tokenFor);
  return fetch(`${baseUrl}/order-history/${customerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('OrderHistoryController', () => {
  test('returns the order history for the authenticated customer', async () => {
    const { baseUrl, findOrders } = await startServer();

    const response = await get(baseUrl, 6, 6);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      orders: [
        {
          orderId: 1,
          date: '01 Nov 2026',
          product: 'Bag of Marbles',
          quantity: 2,
          status: 'Delivered',
        },
      ],
    });
    expect(findOrders).toHaveBeenCalledWith(6);
  });

  test('returns 403 when requesting another customer’s orders', async () => {
    const { baseUrl, findOrders } = await startServer();

    const response = await get(baseUrl, 6, 4);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(findOrders).not.toHaveBeenCalled();
  });

  test('returns 401 without an access token', async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/order-history/6`);

    expect(response.status).toBe(401);
  });

  test('returns 400 for an invalid customer id', async () => {
    const { baseUrl } = await startServer();

    const response = await get(baseUrl, Number.NaN, 6);

    expect(response.status).toBe(400);
  });

  test('returns 404 when the customer has no orders', async () => {
    const { baseUrl } = await startServer(vi.fn().mockResolvedValue([]));

    const response = await get(baseUrl, 6, 6);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'No order history found for customer 6',
    });
  });
});
