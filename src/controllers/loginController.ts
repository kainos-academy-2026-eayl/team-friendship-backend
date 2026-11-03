import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import { ACCESS_TOKEN_TTL_SECONDS } from '../services/accessTokenService';
import {
  type AuthService,
  type AuthTokens,
  InvalidRefreshTokenError,
} from '../services/authService';
import {
  InvalidCredentialsError,
  type LoginService,
  TooManyAttemptsError,
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

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

type LoginServiceContract = Pick<LoginService, 'login'>;
type AuthServiceContract = Pick<
  AuthService,
  'startSession' | 'refresh' | 'logout'
>;

export class LoginController {
  constructor(
    private readonly service: LoginServiceContract,
    private readonly authService: AuthServiceContract,
  ) { }

  login = async (req: Request, res: Response): Promise<void> => {
    const result = loginSchema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid login request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    const customer = await this.service.login(
      result.data.email,
      result.data.password,
      req.ip ?? req.socket.remoteAddress ?? 'unknown',
    );
    const tokens = await this.authService.startSession(customer.customerID);

    this.sendTokens(res, tokens, { message: 'Login successful', customer });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const result = refreshTokenSchema.safeParse(req.body ?? {});
    if (!result.success) {
      throw new InvalidRefreshTokenError();
    }

    const tokens = await this.authService.refresh(result.data.refreshToken);
    this.sendTokens(res, tokens, {});
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const result = refreshTokenSchema.safeParse(req.body ?? {});
    if (result.success) {
      await this.authService.logout(result.data.refreshToken);
    }

    res.status(204).end();
  };

  private sendTokens(
    res: Response,
    tokens: AuthTokens,
    body: Record<string, unknown>,
  ): void {
    res
      .set('Cache-Control', 'no-store')
      .status(200)
      .json({
        ...body,
        accessToken: tokens.accessToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: tokens.refreshToken,
        refreshExpiresAt: tokens.refreshExpiresAt.toISOString(),
      });
  }

  router(): Router {
    const router = Router();

    router.post('/login', this.login);
    router.post('/auth/refresh', this.refresh);
    router.post('/auth/logout', this.logout);

    // Express 5 forwards rejected promises from async handlers to this error handler.
    router.use(
      (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
          next(error);
          return;
        }
        if (error instanceof InvalidCredentialsError) {
          res.status(401).json({ error: error.message });
          return;
        }
        if (error instanceof InvalidRefreshTokenError) {
          res.status(401).json({ error: error.message });
          return;
        }
        if (error instanceof TooManyAttemptsError) {
          res
            .status(429)
            .set('Retry-After', String(error.retryAfterSeconds))
            .json({ error: error.message });
          return;
        }
        console.error('Unexpected login error', error);
        res.status(500).json({ error: 'Internal server error' });
      },
    );

    return router;
  }
}
