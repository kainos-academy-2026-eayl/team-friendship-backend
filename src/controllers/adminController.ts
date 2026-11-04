import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import {
  AdminProductNotFoundError,
  type AdminRepository,
} from '../repositories/adminRepository';
import type { LoginRepository } from '../repositories/loginRepository';

type AdminDataRepository = Pick<
  AdminRepository,
  'getDashboard' | 'reorderStock'
>;
type PrincipalRoleRepository = Pick<LoginRepository, 'findRoleByPrincipal'>;

const periodSchema = z.enum(['today', 'week', 'month']);
const productIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive());

export class AdminController {
  constructor(
    private readonly repository: AdminDataRepository,
    private readonly accounts: PrincipalRoleRepository,
  ) {}

  dashboard = async (req: Request, res: Response): Promise<void> => {
    const period = periodSchema.safeParse(req.query.period ?? 'today');
    if (!period.success) {
      res.status(400).json({ error: 'Period must be today, week or month' });
      return;
    }

    const dashboard = await this.repository.getDashboard(period.data);
    res.set('Cache-Control', 'no-store').status(200).json(dashboard);
  };

  reorderStock = async (req: Request, res: Response): Promise<void> => {
    const productID = productIdSchema.safeParse(req.params.id);
    if (!productID.success) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }

    const product = await this.repository.reorderStock(productID.data);
    res.set('Cache-Control', 'no-store').status(200).json({ product });
  };

  router(): Router {
    const router = Router();

    router.use((_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
    router.use(this.requireAdmin);
    router.get('/dashboard', this.dashboard);
    router.post('/products/:id/reorder', this.reorderStock);
    router.use(this.handleError);

    return router;
  }

  private requireAdmin = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const principal = res.locals.principal;
    if (!principal) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (principal.type !== 'staff') {
      res.status(403).json({ error: 'Administrator access required' });
      return;
    }

    try {
      const role = await this.accounts.findRoleByPrincipal(principal);
      if (role === null) {
        res.status(401).json({ error: 'Account no longer exists' });
        return;
      }
      if (role.toLowerCase() !== 'admin') {
        res.status(403).json({ error: 'Administrator access required' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  private handleError = (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof AdminProductNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error('Unexpected admin request error', error);
    res.status(500).json({ error: 'Internal server error' });
  };
}
