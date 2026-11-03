import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, expect, onTestFinished, test, vi } from 'vitest';
import { OrderController } from '../../src/controllers/orderController';
import { createAccessToken } from '../../src/middleware/authentication';
import { OrderNotFoundError } from '../../src/services/orderService';

const secret = 'test-auth-token-secret-at-least-32-bytes';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function startServer() {
  vi.stubEnv('AUTH_TOKEN_SECRET', secret);
  const service = {
    createOrder: vi.fn(async (input: { customerID: number }) => ({
      orderID: 1,
      customerID: input.customerID,
      status: 'pending',
      dateCreated: new Date(),
      orderServices: [],
    })),
    getOrderById: vi.fn(async (orderID: number, customerID: number) => {
      if (customerID !== 11) {
        throw new OrderNotFoundError(orderID);
      }
      return {
        orderID,
        customerID,
        status: 'pending',
        dateCreated: new Date(),
        orderServices: [],
      };
    }),
    getCustomerOrders: vi.fn(async () => []),
  };
  const app = express();
  app.use(express.json());
  app.use(
    new OrderController(
      service as unknown as ConstructorParameters<typeof OrderController>[0],
    ).router(),
  );
  const server = app.listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, service };
}

function authHeaders(customerID: number) {
  const accessToken = createAccessToken(customerID, secret);
  const authorizationScheme = 'Bearer';
  return {
    'Content-Type': 'application/json',
    Authorization: [authorizationScheme, accessToken].join(' '),
  };
}

test('requires authentication for order routes', async () => {
  const { baseUrl, service } = await startServer();

  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'pending',
      orderServices: [{ productID: 3, quantity: 1 }],
    }),
  });

  expect(response.status).toBe(401);
  expect(service.createOrder).not.toHaveBeenCalled();
});

test('creates an order for the authenticated customer, ignoring a supplied customer ID', async () => {
  const { baseUrl, service } = await startServer();

  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: authHeaders(10),
    body: JSON.stringify({
      customerID: 99,
      status: 'pending',
      orderServices: [{ productID: 3, quantity: 1 }],
    }),
  });

  expect(response.status).toBe(201);
  expect(service.createOrder).toHaveBeenCalledWith({
    customerID: 10,
    status: 'pending',
    orderServices: [{ productID: 3, quantity: 1 }],
  });
});

test('does not return an order belonging to another customer', async () => {
  const { baseUrl, service } = await startServer();

  const response = await fetch(`${baseUrl}/orders/1`, {
    headers: authHeaders(10),
  });

  expect(response.status).toBe(404);
  expect(service.getOrderById).toHaveBeenCalledWith(1, 10);
});

test('returns an order belonging to the authenticated customer', async () => {
  const { baseUrl, service } = await startServer();

  const response = await fetch(`${baseUrl}/orders/1`, {
    headers: authHeaders(11),
  });

  expect(response.status).toBe(200);
  expect(service.getOrderById).toHaveBeenCalledWith(1, 11);
});

test('does not allow reading orders through another customer ID', async () => {
  const { baseUrl, service } = await startServer();

  const response = await fetch(`${baseUrl}/users/11/orders`, {
    headers: authHeaders(10),
  });

  expect(response.status).toBe(404);
  expect(service.getCustomerOrders).not.toHaveBeenCalled();
});

test('reads orders only for the authenticated customer', async () => {
  const { baseUrl, service } = await startServer();

  const response = await fetch(`${baseUrl}/users/10/orders`, {
    headers: authHeaders(10),
  });

  expect(response.status).toBe(200);
  expect(service.getCustomerOrders).toHaveBeenCalledWith(10);
});
