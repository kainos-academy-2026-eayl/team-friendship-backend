import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, onTestFinished, test } from 'vitest';
import { AuthController } from '../../src/controllers/authController';
import { AccessTokenService } from '../../src/services/accessTokenService';

const tokens = new AccessTokenService('a'.repeat(32));

async function startServer(role: string | null = 'customer') {
  const app = express();
  app.use(
    '/',
    new AuthController(tokens, {
      findProfileByPrincipal: async (principal) => {
        if (role === null) return null;
        return {
          role: principal.type === 'staff' ? role : 'customer',
          firstName: 'Ada',
          surname: 'Lovelace',
        };
      },
    }).router(),
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
  return `http://127.0.0.1:${port}`;
}

describe('AuthController.requireAuth', () => {
  test('passes the customer id through for a valid token', async () => {
    const baseUrl = await startServer();
    const token = await tokens.sign(42);

    const response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      customerId: 42,
      role: 'customer',
      firstName: 'Ada',
      surname: 'Lovelace',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('returns the database role for an authenticated admin staff member', async () => {
    const baseUrl = await startServer('admin');
    const token = await tokens.sign({ type: 'staff', id: 42 });

    const response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      staffID: 42,
      role: 'admin',
      firstName: 'Ada',
      surname: 'Lovelace',
    });
  });

  test('returns 401 when the account no longer exists', async () => {
    const baseUrl = await startServer(null);
    const token = await tokens.sign(42);
    const response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: 'Account no longer exists',
    });
  });

  test('returns 401 when the header is missing', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/me`);

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
  });

  test('returns 401 for an invalid token', async () => {
    const baseUrl = await startServer();
    const token = await new AccessTokenService('b'.repeat(32)).sign(42);

    const response = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer error="invalid_token"',
    );
  });
});
