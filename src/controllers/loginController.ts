import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import {
  InvalidCredentialsError,
  type LoginService,
} from '../services/loginService';

export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .pipe(z.email({ error: 'Please enter a valid email address' })),
  password: z
    .string({ error: 'Password is required' })
    .min(1, { error: 'Password is required' })
    .max(128, { error: 'Password must be 128 characters or fewer' }),
});

type LoginServiceContract = Pick<LoginService, 'login'>;

const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_CLIENT_LOGIN_ATTEMPTS = 20;
const MAX_ACCOUNT_LOGIN_ATTEMPTS = 5;

type LoginAttemptWindow = {
  count: number;
  expiresAt: number;
};

class LoginAttemptLimiter {
  private readonly attempts = new Map<string, LoginAttemptWindow>();

  allow(clientIp: string, email: string): boolean {
    const now = Date.now();
    for (const [key, window] of this.attempts) {
      if (window.expiresAt <= now) this.attempts.delete(key);
    }

    const clientKey = `client:${clientIp}`;
    const accountKey = `account:${email.toLowerCase()}`;
    if (
      (this.attempts.get(clientKey)?.count ?? 0) >= MAX_CLIENT_LOGIN_ATTEMPTS ||
      (this.attempts.get(accountKey)?.count ?? 0) >= MAX_ACCOUNT_LOGIN_ATTEMPTS
    ) {
      return false;
    }

    for (const key of [clientKey, accountKey]) {
      const window = this.attempts.get(key);
      if (window) {
        window.count += 1;
      } else {
        this.attempts.set(key, {
          count: 1,
          expiresAt: now + LOGIN_ATTEMPT_WINDOW_MS,
        });
      }
    }
    return true;
  }
}

export class LoginController {
  private readonly attemptLimiter = new LoginAttemptLimiter();

  constructor(private readonly service: LoginServiceContract) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const result = loginSchema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid login request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    if (
      !this.attemptLimiter.allow(
        req.ip ?? req.socket.remoteAddress ?? 'unknown',
        result.data.email,
      )
    ) {
      res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
      });
      return;
    }

    const customer = await this.service.login(
      result.data.email,
      result.data.password,
    );
    res.status(200).json({ message: 'Login successful', customer });
  };

  router(): Router {
    const router = Router();

    router.post('/login', this.login);

    // Express 5 forwards rejected promises from async handlers to this error handler.
    router.use(
      (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (error instanceof InvalidCredentialsError) {
          res.status(401).json({ error: error.message });
          return;
        }
        next(error);
      },
    );

    return router;
  }
}
