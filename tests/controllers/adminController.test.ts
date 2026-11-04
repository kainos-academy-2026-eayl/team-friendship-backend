import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { AdminController } from '../../src/controllers/adminController';
import type { AdminDashboard } from '../../src/repositories/adminRepository';

const dashboard: AdminDashboard = {
  period: 'today',
  totalOrders: 2,
  revenue: 39.98,
  currency: 'GBP',
  lowStockProducts: [
    { productID: 1, productName: 'Empty shelf', productStock: 0 },
    { productID: 2, productName: 'Almost gone', productStock: 4 },
  ],
};

async function startServer(role: 'admin' | 'customer' | null = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.get('x-customer-id')) {
      res.locals.customerId = Number(req.get('x-customer-id'));
    }
    next();
  });

  const repository = {
    getDashboard: vi.fn(async () => dashboard),
    reorderStock: vi.fn(async (productID: number) => ({
      productID,
      productName: 'Empty shelf',
      productStock: 20,
    })),
  };
  const customers = {
    findRoleByCustomerId: vi.fn(async () => role),
  };

  app.use('/admin', new AdminController(repository, customers).router());
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
    baseUrl: `http://127.0.0.1:${port}`,
    repository,
  };
}

describe('admin endpoints', () => {
  test('returns period sales totals and low-stock products to admins', async () => {
    const { baseUrl, repository } = await startServer();

    const response = await fetch(`${baseUrl}/admin/dashboard?period=week`, {
      headers: { 'x-customer-id': '42' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(repository.getDashboard).toHaveBeenCalledWith('week');
    expect(await response.json()).toEqual(dashboard);
  });

  test('rejects invalid reporting periods', async () => {
    const { baseUrl, repository } = await startServer();

    const response = await fetch(`${baseUrl}/admin/dashboard?period=year`, {
      headers: { 'x-customer-id': '42' },
    });

    expect(response.status).toBe(400);
    expect(repository.getDashboard).not.toHaveBeenCalled();
  });

  test('forbids customer accounts from accessing admin data', async () => {
    const { baseUrl, repository } = await startServer('customer');

    const response = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { 'x-customer-id': '42' },
    });

    expect(response.status).toBe(403);
    expect(repository.getDashboard).not.toHaveBeenCalled();
  });

  test('requires an authenticated customer', async () => {
    const { baseUrl, repository } = await startServer();

    const response = await fetch(`${baseUrl}/admin/dashboard`);

    expect(response.status).toBe(401);
    expect(repository.getDashboard).not.toHaveBeenCalled();
  });

  test('reorders exactly 20 units through the repository', async () => {
    const { baseUrl, repository } = await startServer();

    const response = await fetch(`${baseUrl}/admin/products/7/reorder`, {
      method: 'POST',
      headers: {
        'x-customer-id': '42',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ quantity: 9999 }),
    });

    expect(response.status).toBe(200);
    expect(repository.reorderStock).toHaveBeenCalledWith(7);
    expect(await response.json()).toEqual({
      product: {
        productID: 7,
        productName: 'Empty shelf',
        productStock: 20,
      },
    });
  });
});
