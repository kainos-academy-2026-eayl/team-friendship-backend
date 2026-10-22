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

export class LoginController {
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
