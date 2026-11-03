import assert from 'node:assert/strict';
import { once } from 'node:events';
import { onTestFinished, test, vi } from 'vitest';
import { createApp } from '../src/app';

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

vi.mock('../src/services/emailService', () => ({ sendEmail }));

function createTestApp() {
  const passwordResetRepository = {
    createResetToken: vi.fn(async (email: string) => email),
    resetPassword: vi.fn(
      async (
        _email: string,
        _tokenHash: string,
        _passwordHash: string,
        _now: Date,
      ) => true,
    ),
  };

  return {
    app: createApp(undefined, passwordResetRepository),
    passwordResetRepository,
  };
}

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
  const { app } = createTestApp();
  const server = app.listen(0, '127.0.0.1');
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
  const { app, passwordResetRepository } = createTestApp();
  const server = app.listen(0, '127.0.0.1');
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

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message:
      'Recovery email request sent, please check your inbox to continue.',
  });
  assert.equal(sendEmail.mock.calls[0]?.[0].to, 'ada@example.com');
  assert.match(
    sendEmail.mock.calls[0]?.[0].html ?? '',
    /http:\/\/localhost:8000\/reset_password\?email=ada%40example\.com&amp;token=[a-f0-9]{64}/,
  );
  assert.equal(
    passwordResetRepository.createResetToken.mock.calls[0]?.[0],
    'ada@example.com',
  );
});

test('POST /reset-password stores a new password with the supplied reset token', async () => {
  const { app, passwordResetRepository } = createTestApp();
  const server = app.listen(0, '127.0.0.1');
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
    `http://127.0.0.1:${address.port}/reset-password`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'ada@example.com',
        token: 'a'.repeat(64),
        password: 'new-secure-password',
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: 'Password reset successfully.',
  });
  const resetCall = passwordResetRepository.resetPassword.mock.calls[0];
  assert.equal(resetCall?.[0], 'ada@example.com');
  assert.match(resetCall?.[1] ?? '', /^[a-f0-9]{64}$/);
  assert.match(resetCall?.[2] ?? '', /^\$argon2id\$/);
});
