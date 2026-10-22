import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { rateLimit } from 'express-rate-limit';
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
const ATTEMPT_CLEANUP_INTERVAL = 128;

type AttemptWindow = {
  count: number;
  resetAt: number;
};

class LoginAttemptLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();
  private requestsSinceCleanup = 0;

  isLimited(email: string): boolean {
    const now = Date.now();
    const accountKey = `account:${email.toLowerCase()}`;
    const limited = this.hasReachedLimit(
      accountKey,
      now,
      MAX_ACCOUNT_LOGIN_ATTEMPTS,
    );

    if (!limited) {
      this.recordAttempt(accountKey, now);
    }

    this.requestsSinceCleanup += 1;
    if (this.requestsSinceCleanup >= ATTEMPT_CLEANUP_INTERVAL) {
      this.removeExpiredAttempts(now);
      this.requestsSinceCleanup = 0;
    }

    return limited;
  }

  private hasReachedLimit(key: string, now: number, limit: number): boolean {
    const window = this.attempts.get(key);
    return (
      window !== undefined && window.resetAt > now && window.count >= limit
    );
  }

  private recordAttempt(key: string, now: number): void {
    const window = this.attempts.get(key);
    if (!window || window.resetAt <= now) {
      this.attempts.set(key, {
        count: 1,
        resetAt: now + LOGIN_ATTEMPT_WINDOW_MS,
      });
      return;
    }
    window.count += 1;
  }

  private removeExpiredAttempts(now: number): void {
    for (const [key, window] of this.attempts) {
      if (window.resetAt <= now) {
        this.attempts.delete(key);
      }
    }
  }
}

export class LoginController {
  private readonly attemptLimiter = new LoginAttemptLimiter();
  private readonly clientRateLimiter = rateLimit({
    windowMs: LOGIN_ATTEMPT_WINDOW_MS,
    limit: MAX_CLIENT_LOGIN_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Too many login attempts. Please try again later.',
      });
    },
  });

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

    if (this.attemptLimiter.isLimited(result.data.email)) {
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

    router.post('/login', this.clientRateLimiter, this.login);

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
