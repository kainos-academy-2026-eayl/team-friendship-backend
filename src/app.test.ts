import assert from 'node:assert/strict';
import { once } from 'node:events';
import { onTestFinished, test } from 'vitest';
import { createApp } from './app';

test('GET /health returns service status and uptime', async () => {
    const server = createApp().listen(0, '127.0.0.1');
    onTestFinished(() => new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    }));
    await once(server, 'listening');

    const address = server.address();
    assert.ok(address && typeof address !== 'string');

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);

    const body = await response.json() as { status: string; uptime: number; };
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptime, 'number');
    assert.ok(body.uptime >= 0);
});