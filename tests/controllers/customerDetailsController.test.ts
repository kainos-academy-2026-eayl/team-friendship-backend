import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import argon2 from 'argon2';
import express from 'express';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { customerDetailsRouter } from '../../src/controllers/customerDetailsController';
import { Prisma, type PrismaClient } from '../../src/generated/prisma/client';
import { CustomerDetailsRepository } from '../../src/repositories/customerDetailsRepository';
import { LoginAttemptLimiter } from '../../src/services/loginAttemptLimiter';

const hash = await argon2.hash('correct-password');

const customer = {
  customerID: 7,
  customerForename: 'Ada',
  customerSurname: 'Lovelace',
  customerEmail: 'ada@example.com',
  customerPhone: '07123456789',
  address: '12 Example Street',
  postcode: 'BT1 1AA',
};

async function setup(
  principal?: { type: 'customer' | 'staff'; id: number },
  missing = false,
  fail = false,
) {
  const findById = vi.fn(async () => {
    if (fail) throw new Error('Database unavailable');
    return missing ? null : customer;
  });
  const app = express();
  const findPasswordById = vi.fn(async () =>
    missing ? null : { customerPassword: hash },
  );
  const updateDetails = vi.fn(async () => true);
  app.use(express.json());
  app.use((_req, res, next) => {
    if (principal) res.locals.principal = principal;
    next();
  });
  app.use(
    customerDetailsRouter(
      { findById, findPasswordById, updateDetails },
      new LoginAttemptLimiter(2),
    ),
  );
  const server = app.listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/customers/me`,
    findById,
    findPasswordById,
    updateDetails,
  };
}

describe('customer details', () => {
  const { customerID: _id, ...details } = customer;
  const changes = {
    ...details,
    customerForename: 'ada',
    password: 'correct-password',
  };

  test('saves only editable fields for the verified customer after checking the password', async () => {
    const { url, updateDetails } = await setup({ type: 'customer', id: 7 });
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...changes,
        customerID: 99,
        customerPassword: 'injected',
      }),
    });
    expect(response.status).toBe(200);
    expect(updateDetails).toHaveBeenCalledWith(7, hash, {
      ...details,
      customerForename: 'ada',
    });
    expect(JSON.stringify(await response.json())).not.toContain(hash);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test.each([undefined, { type: 'staff' as const, id: 7 }])(
    'denies edits without a customer principal: %j',
    async (principal) => {
      const { url, updateDetails, findPasswordById } = await setup(principal);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(changes),
      });
      expect(response.status).toBe(principal ? 403 : 401);
      expect(updateDetails).not.toHaveBeenCalled();
      expect(findPasswordById).not.toHaveBeenCalled();
    },
  );

  test.each([
    { ...changes, password: '' },
    { ...changes, customerEmail: 'not-an-email' },
    { ...changes, customerSurname: ' ' },
    { ...changes, address: ['invalid'] },
  ])('rejects invalid details before saving', async (body) => {
    const { url, updateDetails } = await setup({ type: 'customer', id: 7 });
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
    expect(updateDetails).not.toHaveBeenCalled();
  });

  test('rejects incorrect passwords and rate limits further attempts', async () => {
    const { url, updateDetails } = await setup({ type: 'customer', id: 7 });
    for (const status of [403, 403, 429]) {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...changes, password: 'wrong' }),
      });
      expect(response.status).toBe(status);
      if (status === 429)
        expect(response.headers.get('retry-after')).toBeTruthy();
    }
    expect(updateDetails).not.toHaveBeenCalled();
  });

  test('does not save after a concurrent password change', async () => {
    const { url, updateDetails } = await setup({ type: 'customer', id: 7 });
    updateDetails.mockResolvedValue(false);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    });
    expect(response.status).toBe(409);
  });

  test('reports an email already in use without claiming to save', async () => {
    const { url, updateDetails } = await setup({ type: 'customer', id: 7 });
    updateDetails.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate email', {
        code: 'P2002',
        clientVersion: '7.10.1',
      }),
    );
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'That email address is already in use. No changes were saved.',
    });
  });

  test('does not update a deleted account', async () => {
    const { url, updateDetails } = await setup(
      { type: 'customer', id: 7 },
      true,
    );
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    });
    expect(response.status).toBe(404);
    expect(updateDetails).not.toHaveBeenCalled();
  });

  test('reports update failures explicitly', async () => {
    const { url, updateDetails } = await setup({ type: 'customer', id: 7 });
    updateDetails.mockRejectedValue(new Error('Database unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(changes),
      });
      expect(response.status).toBe(500);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  test('persists editable fields without modifying the password or name casing', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repo = new CustomerDetailsRepository({
      customer: { updateMany },
    } as unknown as PrismaClient);
    const data = { ...details, customerForename: 'ada' };
    expect(await repo.updateDetails(7, hash, data)).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { customerID: 7, customerPassword: hash },
      data,
    });
    updateMany.mockResolvedValue({ count: 0 });
    expect(await repo.updateDetails(7, hash, data)).toBe(false);
  });

  test('loads only the authenticated customer regardless of supplied IDs', async () => {
    const { url, findById } = await setup({ type: 'customer', id: 7 });
    const response = await fetch(`${url}?customerID=99`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ customer });
    expect(findById).toHaveBeenCalledWith(7);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  test('rejects unauthenticated access', async () => {
    const { url, findById } = await setup();
    expect((await fetch(url)).status).toBe(401);
    expect(findById).not.toHaveBeenCalled();
  });
  test('rejects staff even with the same numeric ID', async () => {
    const { url, findById } = await setup({ type: 'staff', id: 7 });
    expect((await fetch(url)).status).toBe(403);
    expect(findById).not.toHaveBeenCalled();
  });
  test('reports deleted accounts', async () => {
    const { url } = await setup({ type: 'customer', id: 7 }, true);
    expect((await fetch(url)).status).toBe(404);
  });
  test('reports database failures', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { url } = await setup({ type: 'customer', id: 7 }, false, true);
      expect((await fetch(url)).status).toBe(500);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  test('explicitly selects public fields and excludes password hashes', async () => {
    const findUnique = vi.fn().mockResolvedValue(customer);
    const repo = new CustomerDetailsRepository({
      customer: { findUnique },
    } as unknown as PrismaClient);
    await repo.findById(7);
    expect(findUnique).toHaveBeenCalledWith({
      where: { customerID: 7 },
      select: {
        customerID: true,
        customerForename: true,
        customerSurname: true,
        customerEmail: true,
        customerPhone: true,
        address: true,
        postcode: true,
      },
    });
  });
});
