import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import type { LoginRepository } from '../repositories/loginRepository';
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
type CustomerRoleRepository = Pick<LoginRepository, 'findRoleByCustomerId'>;

export class AuthController {
  constructor(
    private readonly tokens: AccessTokenVerifier,
    private readonly customers: CustomerRoleRepository,
  ) {}

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

  me = async (_req: Request, res: Response): Promise<void> => {
    try {
      const customerId = res.locals.customerId;
      if (customerId === undefined) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const role = await this.customers.findRoleByCustomerId(customerId);
      if (!role) {
        res.status(401).json({ error: 'Account no longer exists' });
        return;
      }
      res.status(200).json({ customerId, role });
    } catch (error) {
      console.error('Unable to load authenticated customer', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  router(): Router {
    const router = Router();

    router.get('/me', this.requireAuth, this.me);

    return router;
  }
}
