import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { describe, expect, onTestFinished, test } from 'vitest';
import { createApp } from '../../src/app';
import { LoginController } from '../../src/controllers/loginController';
import {
  type CustomerDetails,
  INVALID_CREDENTIALS_MESSAGE,
  InvalidCredentialsError,
  TOO_MANY_ATTEMPTS_MESSAGE,
  TooManyAttemptsError,
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
  login: (
    email: string,
    password: string,
    clientId: string,
  ) => Promise<CustomerDetails>,
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
    const calls: [string, string, string][] = [];
    const baseUrl = await startServer(async (email, password, clientId) => {
      calls.push([email, password, clientId]);
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
    expect(calls).toEqual([['ada@example.com', 'Password123!', '127.0.0.1']]);
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

  test('returns 429 with Retry-After when attempts are exceeded', async () => {
    const baseUrl = await startServer(async () => {
      throw new TooManyAttemptsError(120);
    });

    const response = await postLogin(baseUrl, {
      email: 'ada@example.com',
      password: 'Password123!',
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
    expect(await response.json()).toEqual({
      error: TOO_MANY_ATTEMPTS_MESSAGE,
    });
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
