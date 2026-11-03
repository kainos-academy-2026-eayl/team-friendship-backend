import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import type { AccessTokenService } from '../services/accessTokenService';

declare global {
  namespace Express {
    interface Locals {
      customerId?: number;
    }
  }
}

const BEARER_PATTERN =
  /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i;

type AccessTokenVerifier = Pick<AccessTokenService, 'verify'>;

export class AuthController {
  constructor(private readonly tokens: AccessTokenVerifier) {}

  requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const token = req.get('authorization')?.match(BEARER_PATTERN)?.[1];
    if (!token) {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer')
        .json({ error: 'Authentication required' });
      return;
    }

    try {
      res.locals.customerId = await this.tokens.verify(token);
    } catch {
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer error="invalid_token"')
        .json({ error: 'Invalid or expired access token' });
      return;
    }

    next();
  };

  me = (_req: Request, res: Response): void => {
    res.status(200).json({ customerId: res.locals.customerId });
  };

  router(): Router {
    const router = Router();

    router.get('/me', this.requireAuth, this.me);

    return router;
  }
}
