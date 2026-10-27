import assert from 'node:assert/strict';
import { once } from 'node:events';
import { onTestFinished, test } from 'vitest';
import { createApp } from '../src/app';

test('GET /health returns service status and uptime', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);

  const body = (await response.json()) as { status: string; uptime: number };
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
  assert.ok(body.uptime >= 0);
});

test('POST /forgot-password rejects malformed email input', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const response = await fetch(
    `http://127.0.0.1:${address.port}/forgot-password`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Invalid forgot password request',
    details: { email: ['Please enter a valid email address'] },
  });
});

test('POST /forgot-password accepts a valid email request shape', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const response = await fetch(
    `http://127.0.0.1:${address.port}/forgot-password`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com' }),
    },
  );

  assert.equal(response.status, 501);
  assert.deepEqual(await response.json(), {
    error: 'Password recovery is not available yet.',
  });
});
