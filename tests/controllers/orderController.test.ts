import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { OrderController } from '../../src/controllers/orderController';
import type { OrderWithServices } from '../../src/repositories/orderRepository';
import type { AuthPrincipal } from '../../src/services/accessTokenService';
import {
  InsufficientStockError,
  InvalidDiscountCodeError,
  OrderNotFoundError,
  OrderProductNotFoundError,
} from '../../src/services/orderService';

const CUSTOMER_ID = 1;

const ORDER: OrderWithServices = {
  orderID: 7,
  customerID: CUSTOMER_ID,
  dateCreated: new Date('2026-11-04T12:00:00Z'),
  status: 'pending',
  address: '123 Town Street',
  postcode: 'BT16 AAA',
  discountCode: null,
  discountAmount: 0,
  discountCodeID: null,
  orderServices: [],
};

function createService() {
  return {
    createOrder: vi.fn(async () => ORDER),
    getOrderForCustomer: vi.fn(async () => ORDER),
    listOrdersForCustomer: vi.fn(async () => [ORDER]),
  };
}

async function startServer(
  service = createService(),
  principal: AuthPrincipal | null = { type: 'customer', id: CUSTOMER_ID },
) {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    if (principal !== null) {
      res.locals.principal = principal;
    }
    next();
  });
  app.use('/', new OrderController(service).router());
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

type OrderResponseBody = {
  error?: string;
  productID?: number;
  order?: { orderID: number };
  orders?: unknown[];
};

async function readBody(response: Response): Promise<OrderResponseBody> {
  return (await response.json()) as OrderResponseBody;
}

function postOrder(baseUrl: string, body: unknown) {
  return fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  customerID: CUSTOMER_ID,
  orderServices: [
    { productID: 1, quantity: 2 },
    { productID: 3, quantity: 1 },
  ],
};

describe('POST /orders', () => {
  test('creates an order for the authenticated customer', async () => {
    const { baseUrl, service } = await startServer();

    const response = await postOrder(baseUrl, VALID_BODY);

    expect(response.status).toBe(201);
    expect(response.headers.get('location')).toBe('/orders/7');
    expect((await readBody(response)).order?.orderID).toBe(7);
    expect(service.createOrder).toHaveBeenCalledWith(
      CUSTOMER_ID,
      VALID_BODY.orderServices,
      undefined,
      undefined,
    );
  });

  test('passes an alternative delivery address to the service', async () => {
    const { baseUrl, service } = await startServer();

    const response = await postOrder(baseUrl, {
      ...VALID_BODY,
      address: '  14 Gift Lane ',
      postcode: 'BT9 5AB',
    });

    expect(response.status).toBe(201);
    expect(service.createOrder).toHaveBeenCalledWith(
      CUSTOMER_ID,
      VALID_BODY.orderServices,
      { address: '14 Gift Lane', postcode: 'BT9 5AB' },
      undefined,
    );
  });

  test('passes a valid discount code to the service, ignoring case and spaces', async () => {
    const { baseUrl, service } = await startServer();

    const response = await postOrder(baseUrl, {
      ...VALID_BODY,
      discountCode: ' friendship12 ',
    });

    expect(response.status).toBe(201);
    expect(service.createOrder).toHaveBeenCalledWith(
      CUSTOMER_ID,
      VALID_BODY.orderServices,
      undefined,
      'friendship12',
    );
  });

  test('returns 400 when the service rejects the discount code', async () => {
    const service = createService();
    service.createOrder.mockRejectedValueOnce(new InvalidDiscountCodeError());
    const { baseUrl } = await startServer(service);

    const response = await postOrder(baseUrl, {
      ...VALID_BODY,
      discountCode: 'FREESTUFF',
    });

    expect(response.status).toBe(400);
    expect(await readBody(response)).toEqual({
      error: 'Invalid discount code',
    });
    expect(service.createOrder).toHaveBeenCalledWith(
      CUSTOMER_ID,
      VALID_BODY.orderServices,
      undefined,
      'FREESTUFF',
    );
  });

  test.each([
    ['missing order services', { customerID: CUSTOMER_ID }],
    ['empty order services', { customerID: CUSTOMER_ID, orderServices: [] }],
    [
      'non-positive quantity',
      {
        customerID: CUSTOMER_ID,
        orderServices: [{ productID: 1, quantity: 0 }],
      },
    ],
    [
      'fractional quantity',
      {
        customerID: CUSTOMER_ID,
        orderServices: [{ productID: 1, quantity: 1.5 }],
      },
    ],
    [
      'duplicate products',
      {
        customerID: CUSTOMER_ID,
        orderServices: [
          { productID: 1, quantity: 1 },
          { productID: 1, quantity: 2 },
        ],
      },
    ],
    ['missing customer id', { orderServices: [{ productID: 1, quantity: 1 }] }],
    ['address without postcode', { ...VALID_BODY, address: '14 Gift Lane' }],
    ['postcode without address', { ...VALID_BODY, postcode: 'BT9 5AB' }],
    ['blank address', { ...VALID_BODY, address: '   ', postcode: 'BT9 5AB' }],
    [
      'null postcode',
      { ...VALID_BODY, address: '14 Gift Lane', postcode: null },
    ],
  ])('returns 400 for %s', async (_name, body) => {
    const { baseUrl, service } = await startServer();

    const response = await postOrder(baseUrl, body);

    expect(response.status).toBe(400);
    expect((await readBody(response)).error).toBe('Invalid order request');
    expect(service.createOrder).not.toHaveBeenCalled();
  });

  test('returns 403 when ordering for another customer', async () => {
    const { baseUrl, service } = await startServer();

    const response = await postOrder(baseUrl, { ...VALID_BODY, customerID: 2 });

    expect(response.status).toBe(403);
    expect(service.createOrder).not.toHaveBeenCalled();
  });

  test('returns 400 when a product does not exist', async () => {
    const service = createService();
    service.createOrder.mockRejectedValueOnce(
      new OrderProductNotFoundError(99),
    );
    const { baseUrl } = await startServer(service);

    const response = await postOrder(baseUrl, VALID_BODY);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Product 99 not found',
      productID: 99,
    });
  });

  test('returns 409 when stock is insufficient', async () => {
    const service = createService();
    service.createOrder.mockRejectedValueOnce(new InsufficientStockError(3));
    const { baseUrl } = await startServer(service);

    const response = await postOrder(baseUrl, VALID_BODY);

    expect(response.status).toBe(409);
    expect((await readBody(response)).productID).toBe(3);
  });

  test('returns 500 for unexpected errors', async () => {
    const service = createService();
    service.createOrder.mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    const { baseUrl } = await startServer(service);

    const response = await postOrder(baseUrl, VALID_BODY);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });

  test('returns 401 when no customer is authenticated', async () => {
    const { baseUrl } = await startServer(createService(), null);

    const response = await postOrder(baseUrl, VALID_BODY);

    expect(response.status).toBe(401);
  });

  test('returns 401 for staff accounts', async () => {
    const { baseUrl, service } = await startServer(createService(), {
      type: 'staff',
      id: CUSTOMER_ID,
    });

    const response = await postOrder(baseUrl, VALID_BODY);

    expect(response.status).toBe(401);
    expect(service.createOrder).not.toHaveBeenCalled();
  });
});

describe('GET /orders/:id', () => {
  test('returns the order for the authenticated customer', async () => {
    const { baseUrl, service } = await startServer();

    const response = await fetch(`${baseUrl}/orders/7`);

    expect(response.status).toBe(200);
    expect((await readBody(response)).order?.orderID).toBe(7);
    expect(service.getOrderForCustomer).toHaveBeenCalledWith(7, CUSTOMER_ID);
  });

  test('returns 400 for an invalid id', async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/orders/abc`);

    expect(response.status).toBe(400);
  });

  test('returns 404 when the order is not found', async () => {
    const service = createService();
    service.getOrderForCustomer.mockRejectedValueOnce(
      new OrderNotFoundError(7),
    );
    const { baseUrl } = await startServer(service);

    const response = await fetch(`${baseUrl}/orders/7`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Order 7 not found' });
  });
});

describe('GET /users/:id/orders', () => {
  test('lists orders for the authenticated customer', async () => {
    const { baseUrl, service } = await startServer();

    const response = await fetch(`${baseUrl}/users/${CUSTOMER_ID}/orders`);

    expect(response.status).toBe(200);
    expect((await readBody(response)).orders).toHaveLength(1);
    expect(service.listOrdersForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  test('returns 403 for another user', async () => {
    const { baseUrl, service } = await startServer();

    const response = await fetch(`${baseUrl}/users/2/orders`);

    expect(response.status).toBe(403);
    expect(service.listOrdersForCustomer).not.toHaveBeenCalled();
  });

  test('returns 400 for an invalid id', async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/users/0/orders`);

    expect(response.status).toBe(400);
  });
});
