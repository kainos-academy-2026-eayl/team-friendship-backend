import argon2 from 'argon2';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Customer } from '../../src/generated/prisma/client';
import { LoginAttemptLimiter } from '../../src/services/loginAttemptLimiter';
import {
  INVALID_CREDENTIALS_MESSAGE,
  InvalidCredentialsError,
  LoginService,
  TooManyAttemptsError,
} from '../../src/services/loginService';

const PASSWORD = 'Password123!';
const CLIENT = '203.0.113.1';
let customer: Customer;

function createService(
  found: Customer | null,
  limiter = new LoginAttemptLimiter(),
) {
  let lookups = 0;
  const service = new LoginService(
    {
      findCustomerByEmail: async () => {
        lookups += 1;
        return found;
      },
    },
    limiter,
  );
  return { service, lookups: () => lookups };
}

async function failLogin(
  service: LoginService,
  email = 'ada@example.com',
  client = CLIENT,
) {
  await expect(service.login(email, 'wrong', client)).rejects.toBeInstanceOf(
    InvalidCredentialsError,
  );
}

beforeAll(async () => {
  customer = {
    customerID: 1,
    customerForename: 'Ada',
    customerSurname: 'Lovelace',
    address: '1 Test Street',
    postcode: 'BT1 1AA',
    customerEmail: 'ada@example.com',
    customerPhone: '07123456789',
    customerPassword: await argon2.hash(PASSWORD),
  };
});

describe('LoginService.login', () => {
  test('returns customer details without the password for valid credentials', async () => {
    const result = await createService(customer).service.login(
      'ada@example.com',
      PASSWORD,
      CLIENT,
    );

    expect(result).not.toHaveProperty('customerPassword');
    expect(result).toMatchObject({
      customerID: 1,
      customerEmail: 'ada@example.com',
    });
  });

  test('rejects an invalid password', async () => {
    await expect(
      createService(customer).service.login(
        'ada@example.com',
        'WrongPassword1!',
        CLIENT,
      ),
    ).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
  });

  test('rejects a password with characters in the wrong case', async () => {
    await expect(
      createService(customer).service.login(
        'ada@example.com',
        'pASSWORD123!',
        CLIENT,
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  test('rejects an unknown email with the same message', async () => {
    await expect(
      createService(null).service.login('nobody@example.com', PASSWORD, CLIENT),
    ).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
  });

  test('rejects when the stored password is not an argon2 hash', async () => {
    await expect(
      createService({ ...customer, customerPassword: PASSWORD }).service.login(
        'ada@example.com',
        PASSWORD,
        CLIENT,
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe('LoginService.login attempt limits', () => {
  test('blocks the 6th attempt on an account before verifying the password', async () => {
    const { service, lookups } = createService(customer);
    for (let i = 0; i < 5; i++) {
      await failLogin(service, 'ada@example.com', `client-${i}`);
    }

    const attempt = service.login('ADA@example.com', PASSWORD, 'new-client');

    await expect(attempt).rejects.toBeInstanceOf(TooManyAttemptsError);
    await expect(attempt).rejects.toMatchObject({ retryAfterSeconds: 900 });
    expect(lookups()).toBe(5);
  });

  test('blocks a client after 5 attempts across different accounts', async () => {
    const { service } = createService(customer);
    for (let i = 0; i < 5; i++) {
      await failLogin(service, `user${i}@example.com`);
    }

    await expect(
      service.login('ada@example.com', PASSWORD, CLIENT),
    ).rejects.toBeInstanceOf(TooManyAttemptsError);
    await expect(
      service.login('ada@example.com', PASSWORD, 'other-client'),
    ).resolves.toMatchObject({ customerID: 1 });
  });

  test('a successful login resets the account count', async () => {
    const { service } = createService(customer);
    for (let i = 0; i < 4; i++) {
      await failLogin(service, 'ada@example.com', `client-${i}`);
    }
    await service.login('ada@example.com', PASSWORD, 'client-x');

    for (let i = 0; i < 5; i++) {
      await failLogin(service, 'ada@example.com', `client-y${i}`);
    }
    await expect(
      service.login('ada@example.com', PASSWORD, 'client-z'),
    ).rejects.toBeInstanceOf(TooManyAttemptsError);
  });

  test('allows attempts again once the window has passed', async () => {
    let now = 0;
    const limiter = new LoginAttemptLimiter(5, 1000, () => now);
    const { service } = createService(customer, limiter);
    for (let i = 0; i < 5; i++) {
      await failLogin(service);
    }
    await expect(
      service.login('ada@example.com', PASSWORD, CLIENT),
    ).rejects.toBeInstanceOf(TooManyAttemptsError);

    now = 1000;

    await expect(
      service.login('ada@example.com', PASSWORD, CLIENT),
    ).resolves.toMatchObject({ customerID: 1 });
  });
});
