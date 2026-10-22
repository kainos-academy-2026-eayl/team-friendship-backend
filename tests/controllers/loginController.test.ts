import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { describe, expect, onTestFinished, test } from 'vitest';
import { createApp } from '../../src/app';
import { LoginController } from '../../src/controllers/loginController';
import {
  type CustomerDetails,
  INVALID_CREDENTIALS_MESSAGE,
  InvalidCredentialsError,
} from '../../src/services/loginService';

const customer: CustomerDetails = {
  customerID: 1,
  customerForename: 'Ada',
  customerSurname: 'Lovelace',
  address: '1 Test Street',
  postcode: 'BT1 1AA',
  customerEmail: 'ada@example.com',
  customerPhone: '07123456789',
};

async function startServer(
  login: (email: string, password: string) => Promise<CustomerDetails>,
) {
  const app = createApp();
  app.use('/', new LoginController({ login }).router());
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

function postLogin(baseUrl: string, body: unknown) {
  return fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:8000',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /login', () => {
  test('returns 200 and customer details for valid credentials', async () => {
    const calls: [string, string][] = [];
    const baseUrl = await startServer(async (email, password) => {
      calls.push([email, password]);
      return customer;
    });

    const response = await postLogin(baseUrl, {
      email: '  ada@example.com ',
      password: 'Password123!',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:8000',
    );
    expect(await response.json()).toEqual({
      message: 'Login successful',
      customer,
    });
    expect(calls).toEqual([['ada@example.com', 'Password123!']]);
  });

  test('returns 401 with a generic message for invalid credentials', async () => {
    const baseUrl = await startServer(async () => {
      throw new InvalidCredentialsError();
    });

    const response = await postLogin(baseUrl, {
      email: 'ada@example.com',
      password: 'wrong',
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: INVALID_CREDENTIALS_MESSAGE,
    });
  });

  test('returns 429 before login when the per-account attempt limit is reached', async () => {
    let calls = 0;
    const baseUrl = await startServer(async () => {
      calls += 1;
      throw new InvalidCredentialsError();
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postLogin(baseUrl, {
        email: 'ada@example.com',
        password: 'wrong',
      });
      expect(response.status).toBe(401);
    }

    const response = await postLogin(baseUrl, {
      email: 'ada@example.com',
      password: 'wrong',
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'Too many login attempts. Please try again later.',
    });
    expect(calls).toBe(5);
  });

  test('returns 429 before login when the per-client attempt limit is reached', async () => {
    let calls = 0;
    const baseUrl = await startServer(async () => {
      calls += 1;
      throw new InvalidCredentialsError();
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await postLogin(baseUrl, {
        email: `user${attempt}@example.com`,
        password: 'wrong',
      });
      expect(response.status).toBe(401);
    }

    const response = await postLogin(baseUrl, {
      email: 'another@example.com',
      password: 'wrong',
    });

    expect(response.status).toBe(429);
    expect(calls).toBe(20);
  });

  test('returns 400 with field errors when the body is invalid', async () => {
    let called = false;
    const baseUrl = await startServer(async () => {
      called = true;
      return customer;
    });

    const response = await postLogin(baseUrl, {
      email: 'not-an-email',
      password: '',
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      details: Record<string, string[]>;
    };
    expect(body.details.email).toEqual(['Please enter a valid email address']);
    expect(body.details.password).toEqual(['Password is required']);
    expect(called).toBe(false);
  });

  test('returns 400 when fields are missing', async () => {
    const baseUrl = await startServer(async () => customer);

    const response = await postLogin(baseUrl, {});

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      details: Record<string, string[]>;
    };
    expect(body.details.email).toEqual(['Email is required']);
    expect(body.details.password).toEqual(['Password is required']);
  });
});
