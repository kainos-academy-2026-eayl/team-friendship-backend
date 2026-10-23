import assert from 'node:assert/strict';
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
  username: 'ada@example.com',
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

test('register maps username to email, hashes the password, and omits it from the result', async () => {
  const { service, created } = createService();

  const customer = await service.register(validRegistration);

  assert.equal(customer.customerEmail, validRegistration.username);
  assert.equal(created.length, 1);
  assert.notEqual(created[0]?.customerPassword, validRegistration.password);
  assert.match(
    created[0]?.customerPassword ?? '',
    /^[a-f\d]{32}:[a-f\d]{128}$/,
  );
  assert.equal('customerPassword' in customer, false);
});

test('register rejects a username shorter than three characters with the Zod message', async () => {
  const { service, created } = createService();

  await assert.rejects(
    service.register({ ...validRegistration, username: 'ab' }),
    (error: unknown) => {
      assert.ok(error instanceof RegistrationValidationError);
      assert.equal(error.message, 'Username must be at least 3 characters.');
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
