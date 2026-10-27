import assert from 'node:assert/strict';
import argon2 from 'argon2';
import { test } from 'vitest';
import type {
  CustomerRepository,
  NewCustomer,
} from '../../src/models/customerModel';
import {
  CustomerService,
  RegistrationValidationError,
} from '../../src/services/customerService';

const validRegistration = {
  customerForename: 'Ada',
  customerSurname: 'Lovelace',
  address: '12 Analytical Engine Way',
  postcode: 'N1 1AA',
  customerEmail: 'ada@example.com',
  customerPhone: '01234567890',
  password: 'a secure password',
  confirmPassword: 'a secure password',
};

function createService() {
  const created: NewCustomer[] = [];
  const repository: CustomerRepository = {
    async create(customer) {
      created.push(customer);
      return { ...customer, customerID: created.length };
    },
  };

  return { service: new CustomerService(repository), created };
}

test('register hashes the password with argon2 and omits it from the result', async () => {
  const { service, created } = createService();

  const customer = await service.register(validRegistration);

  assert.equal(customer.customerEmail, validRegistration.customerEmail);
  assert.equal(created.length, 1);
  const storedHash = created[0]?.customerPassword ?? '';
  assert.notEqual(storedHash, validRegistration.password);
  assert.match(storedHash, /^\$argon2id\$/);
  assert.ok(await argon2.verify(storedHash, validRegistration.password));
  assert.equal('customerPassword' in customer, false);
});

test('register rejects an invalid email with the Zod message', async () => {
  const { service, created } = createService();

  await assert.rejects(
    service.register({ ...validRegistration, customerEmail: 'ab' }),
    (error: unknown) => {
      assert.ok(error instanceof RegistrationValidationError);
      assert.equal(error.message, 'Enter a valid email address.');
      return true;
    },
  );
  assert.equal(created.length, 0);
});

test('register rejects passwords that do not match with the Zod message', async () => {
  const { service, created } = createService();

  await assert.rejects(
    service.register({
      ...validRegistration,
      confirmPassword: 'different password',
    }),
    (error: unknown) => {
      assert.ok(error instanceof RegistrationValidationError);
      assert.equal(error.message, 'Passwords do not match.');
      return true;
    },
  );
  assert.equal(created.length, 0);
});

test('register rejects request fields that do not match the Zod schema', async () => {
  const { service, created } = createService();

  await assert.rejects(
    service.register({
      ...validRegistration,
      customerForename: 123,
    }),
    (error: unknown) => {
      assert.ok(error instanceof RegistrationValidationError);
      assert.equal(
        error.message,
        'Invalid input: expected string, received number',
      );
      return true;
    },
  );
  assert.equal(created.length, 0);
});
