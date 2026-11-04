import { SignJWT, UnsecuredJWT } from 'jose';
import { describe, expect, test } from 'vitest';
import {
  AccessTokenService,
  InvalidAccessTokenError,
} from '../../src/services/accessTokenService';

const SECRET = 'a'.repeat(32);
const service = new AccessTokenService(SECRET);

describe('AccessTokenService', () => {
  test('rejects secrets shorter than 32 bytes', () => {
    expect(() => new AccessTokenService('short')).toThrow(/at least 32 bytes/);
  });

  test('signs and verifies a customer principal', async () => {
    const token = await service.sign(42);

    await expect(service.verify(token)).resolves.toEqual({
      type: 'customer',
      id: 42,
    });
  });

  test('signs and verifies a staff principal without ID collisions', async () => {
    const token = await service.sign({ type: 'staff', id: 42 });

    await expect(service.verify(token)).resolves.toEqual({
      type: 'staff',
      id: 42,
    });
  });

  test('rejects a token signed with a different secret', async () => {
    const token = await new AccessTokenService('b'.repeat(32)).sign(42);

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  test('rejects a tampered token', async () => {
    const token = await service.sign(42);
    const [header, , signature] = token.split('.');
    const payload = Buffer.from(JSON.stringify({ sub: '1' })).toString(
      'base64url',
    );

    await expect(
      service.verify(`${header}.${payload}.${signature}`),
    ).rejects.toBeInstanceOf(InvalidAccessTokenError);
  });

  test('rejects an expired token', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('42')
      .setIssuer('team-friendship-backend')
      .setAudience('team-friendship-frontend')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(SECRET));

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  test('rejects an unsigned token', async () => {
    const token = new UnsecuredJWT({})
      .setSubject('42')
      .setIssuer('team-friendship-backend')
      .setAudience('team-friendship-frontend')
      .setExpirationTime('15m')
      .encode();

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  test('rejects a token for a different audience', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('42')
      .setIssuer('team-friendship-backend')
      .setAudience('another-app')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET));

    await expect(service.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});
