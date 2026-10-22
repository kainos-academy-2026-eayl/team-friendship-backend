import argon2 from 'argon2';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Customer } from '../../src/generated/prisma/client';
import {
  INVALID_CREDENTIALS_MESSAGE,
  InvalidCredentialsError,
  LoginService,
} from '../../src/services/loginService';

const PASSWORD = 'Password123!';
let customer: Customer;

function createService(found: Customer | null) {
  return new LoginService({ findCustomerByEmail: async () => found });
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
    const result = await createService(customer).login(
      'ada@example.com',
      PASSWORD,
    );

    expect(result).not.toHaveProperty('customerPassword');
    expect(result).toMatchObject({
      customerID: 1,
      customerEmail: 'ada@example.com',
    });
  });

  test('rejects an invalid password', async () => {
    await expect(
      createService(customer).login('ada@example.com', 'WrongPassword1!'),
    ).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
  });

  test('rejects a password with characters in the wrong case', async () => {
    await expect(
      createService(customer).login('ada@example.com', 'pASSWORD123!'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  test('rejects an unknown email with the same message', async () => {
    await expect(
      createService(null).login('nobody@example.com', PASSWORD),
    ).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
  });

  test('rejects when the stored password is not an argon2 hash', async () => {
    await expect(
      createService({ ...customer, customerPassword: PASSWORD }).login(
        'ada@example.com',
        PASSWORD,
      ),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
