import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const TOKEN_LIFETIME_SECONDS = 60 * 60;
const MINIMUM_SECRET_BYTES = 32;

interface AccessTokenPayload {
  customerID: number;
  expiresAt: number;
}

export class AuthenticationConfigurationError extends Error {
  constructor() {
    super('AUTH_TOKEN_SECRET must be at least 32 bytes');
    this.name = 'AuthenticationConfigurationError';
  }
}

declare global {
  namespace Express {
    interface Request {
      authenticatedCustomerID?: number;
    }
  }
}

function getSigningSecret(secret = process.env.AUTH_TOKEN_SECRET): string {
  if (!secret || Buffer.byteLength(secret) < MINIMUM_SECRET_BYTES) {
    throw new AuthenticationConfigurationError();
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAccessToken(
  customerID: number,
  secret?: string,
  now = Date.now(),
): string {
  const signingSecret = getSigningSecret(secret);
  const payload = Buffer.from(
    JSON.stringify({
      customerID,
      expiresAt: Math.floor(now / 1000) + TOKEN_LIFETIME_SECONDS,
    } satisfies AccessTokenPayload),
  ).toString('base64url');

  return `${payload}.${sign(payload, signingSecret)}`;
}

export function authenticateCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  let secret: string;
  try {
    secret = getSigningSecret();
  } catch {
    res
      .status(503)
      .json({ error: 'Authentication is temporarily unavailable' });
    return;
  }

  const authorization = req.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];
  if (
    scheme !== 'Bearer' ||
    !token ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const expectedSignature = Buffer.from(sign(payload, secret), 'base64url');
  const providedSignature = Buffer.from(signature, 'base64url');
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Partial<AccessTokenPayload>;
    if (
      !Number.isInteger(claims.customerID) ||
      !claims.customerID ||
      claims.customerID < 1 ||
      !Number.isInteger(claims.expiresAt) ||
      !claims.expiresAt ||
      claims.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.authenticatedCustomerID = claims.customerID;
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  next();
}
