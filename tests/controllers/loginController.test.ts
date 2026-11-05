import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { createApp } from '../../src/app';
import { LoginController } from '../../src/controllers/loginController';
import type { AuthPrincipal } from '../../src/services/accessTokenService';
import {
  type AuthService,
  type AuthTokens,
  InvalidRefreshTokenError,
} from '../../src/services/authService';
import {
  type CustomerDetails,
  INVALID_CREDENTIALS_MESSAGE,
  InvalidCredentialsError,
  type LoginAccount,
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
const customerAccount: LoginAccount = {
  principal: { type: 'customer', id: customer.customerID },
  customer: { ...customer, role: 'customer' },
};
const adminAccount: LoginAccount = {
  principal: { type: 'staff', id: 2 },
  customer: {
    staffID: 2,
    staffForename: 'Friendshop',
    staffSurname: 'Administrator',
    staffRole: 'ADMIN',
    staffavailability: 'AVAILABLE',
    staffEmail: 'admin@friendshop.com',
    role: 'admin',
  },
};

const tokens: AuthTokens = {
  accessToken: 'access.jwt.token',
  refreshToken: 'refresh-token',
  refreshExpiresAt: new Date('2030-01-08T00:00:00Z'),
};

type AuthContract = Pick<AuthService, 'startSession' | 'refresh' | 'logout'>;

function fakeAuth(overrides: Partial<AuthContract> = {}): AuthContract {
  return {
    startSession: async () => tokens,
    refresh: async () => tokens,
    logout: async () => {},
    ...overrides,
  };
}

async function startServer(
  login: (
    email: string,
    password: string,
    clientId: string,
  ) => Promise<LoginAccount>,
  auth: AuthContract = fakeAuth(),
) {
  const app = createApp();
  app.use('/', new LoginController({ login }, auth).router());
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
  test('returns 200, customer details and tokens for valid credentials', async () => {
    const calls: [string, string, string][] = [];
    const sessions: (AuthPrincipal | number)[] = [];
    const baseUrl = await startServer(
      async (email, password, clientId) => {
        calls.push([email, password, clientId]);
        return customerAccount;
      },
      fakeAuth({
        startSession: async (principal) => {
          sessions.push(principal);
          return tokens;
        },
      }),
    );

    const response = await postLogin(baseUrl, {
      email: '  ada@example.com ',
      password: 'Password123!',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:8000',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      message: 'Login successful',
      customer: customerAccount.customer,
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
    });
    expect(calls).toEqual([['ada@example.com', 'Password123!', '127.0.0.1']]);
    expect(sessions).toEqual([{ type: 'customer', id: customer.customerID }]);
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

  test('returns the stored admin role for an admin login', async () => {
    const baseUrl = await startServer(async () => adminAccount);

    const response = await postLogin(baseUrl, {
      email: 'admin@friendshop.com',
      password: 'Password1!',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      customer: { role: string };
    };
    expect(body.customer.role).toBe('admin');
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

  test('returns a generic JSON error for unexpected service failures', async () => {
    const error = new Error('Database connection details');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    onTestFinished(() => log.mockRestore());
    const baseUrl = await startServer(async () => {
      throw error;
    });

    const response = await postLogin(baseUrl, {
      email: 'ada@example.com',
      password: 'Password123!',
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(log).toHaveBeenCalledWith('Unexpected login error', error);
  });

  test('returns 400 with field errors when the body is invalid', async () => {
    let called = false;
    const baseUrl = await startServer(async () => {
      called = true;
      return customerAccount;
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
    const baseUrl = await startServer(async () => customerAccount);

    const response = await postLogin(baseUrl, {});

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      details: Record<string, string[]>;
    };
    expect(body.details.email).toEqual(['Email is required']);
    expect(body.details.password).toEqual(['Password is required']);
  });
});

function postAuth(baseUrl: string, path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

describe('POST /auth/refresh', () => {
  test('rotates the refresh token and returns new tokens', async () => {
    const received: string[] = [];
    const baseUrl = await startServer(
      async () => customerAccount,
      fakeAuth({
        refresh: async (token) => {
          received.push(token);
          return tokens;
        },
      }),
    );

    const response = await postAuth(baseUrl, '/auth/refresh', {
      refreshToken: 'old-token',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
    });
    expect(received).toEqual(['old-token']);
  });

  test('returns 401 without calling the service when the token is missing', async () => {
    let called = false;
    const baseUrl = await startServer(
      async () => customerAccount,
      fakeAuth({
        refresh: async () => {
          called = true;
          return tokens;
        },
      }),
    );

    const response = await postAuth(baseUrl, '/auth/refresh');

    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test('returns 401 when the token is rejected', async () => {
    const baseUrl = await startServer(
      async () => customerAccount,
      fakeAuth({
        refresh: async () => {
          throw new InvalidRefreshTokenError();
        },
      }),
    );

    const response = await postAuth(baseUrl, '/auth/refresh', {
      refreshToken: 'reused-token',
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: new InvalidRefreshTokenError().message,
    });
  });
});

describe('POST /auth/logout', () => {
  test('revokes the session', async () => {
    const revoked: string[] = [];
    const baseUrl = await startServer(
      async () => customerAccount,
      fakeAuth({
        logout: async (token) => {
          revoked.push(token);
        },
      }),
    );

    const response = await postAuth(baseUrl, '/auth/logout', {
      refreshToken: 'current-token',
    });

    expect(response.status).toBe(204);
    expect(revoked).toEqual(['current-token']);
  });

  test('returns 204 when there is no token', async () => {
    const baseUrl = await startServer(async () => customerAccount);

    const response = await postAuth(baseUrl, '/auth/logout');

    expect(response.status).toBe(204);
  });
});
