import assert from 'node:assert/strict';
import { once } from 'node:events';
import { onTestFinished, test } from 'vitest';
import { createApp } from '../src/app';
import type {
  CustomerRepository,
  NewCustomer,
} from '../src/repositories/customerRepository';

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

function createRepository() {
  const created: NewCustomer[] = [];
  const repository: CustomerRepository = {
    async create(customer) {
      created.push(customer);
      return { ...customer, customerID: created.length };
    },
  };
  return { repository, created };
}

async function postRegistration(
  repository: CustomerRepository,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = createApp(repository).listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const response = await fetch(`http://127.0.0.1:${address.port}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

test('POST /register creates an account without returning its password', async () => {
  const { repository, created } = createRepository();

  const response = await postRegistration(repository, validRegistration);

  assert.equal(response.status, 201);
  assert.equal(created.length, 1);
  assert.equal(created[0]?.customerEmail, validRegistration.username);
  assert.notEqual(created[0]?.customerPassword, validRegistration.password);
  assert.deepEqual(response.body, {
    message: 'Account created successfully.',
    customer: {
      customerID: 1,
      customerForename: 'Ada',
      customerSurname: 'Lovelace',
      address: '12 Analytical Engine Way',
      postcode: 'N1 1AA',
      customerEmail: 'ada@example.com',
      customerPhone: '01234567890',
    },
  });
});

test('POST /register rejects usernames shorter than three characters', async () => {
  const { repository, created } = createRepository();

  const response = await postRegistration(repository, {
    ...validRegistration,
    username: 'ab',
  });

  assert.equal(response.status, 400);
  assert.equal(
    response.body.message,
    'Username must be at least 3 characters.',
  );
  assert.equal(created.length, 0);
});

test('POST /register rejects mismatched passwords', async () => {
  const { repository, created } = createRepository();

  const response = await postRegistration(repository, {
    ...validRegistration,
    confirmPassword: 'different password',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Passwords do not match.');
  assert.equal(created.length, 0);
});
