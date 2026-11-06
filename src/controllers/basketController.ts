import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import { BasketError } from '../models/basketModel';
import type { BasketService } from '../services/basketService';

const id = z.int32().positive();
const idParam = z.coerce.number().pipe(id);
const addSchema = z.object({ productID: id, quantity: id });
const quantitySchema = z.union([
  z.object({ quantity: id }).strict(),
  z.object({ change: z.union([z.literal(-1), z.literal(1)]) }).strict(),
]);

function customerId(res: Response): number | undefined {
  const principal = res.locals.principal;
  if (!principal) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (principal.type !== 'customer') {
    res.status(403).json({ error: 'A customer account is required.' });
    return;
  }
  return principal.id;
}

export class BasketController {
  constructor(
    private readonly basketService: Pick<
      BasketService,
      'getBasket' | 'addToBasket' | 'updateQuantity' | 'removeFromBasket'
    >,
  ) {}

  private readonly getBasket = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const customerID = customerId(res);
    if (customerID === undefined) return;
    const requested = idParam.safeParse(req.params.customerID);
    if (!requested.success) {
      res.status(400).json({ error: 'Invalid customer ID.' });
      return;
    }
    if (requested.data !== customerID) {
      res.status(403).json({ error: 'You can only view your own basket.' });
      return;
    }

    const basket = await this.basketService.getBasket(customerID);

    res.json({ basket });
  };

  private readonly addToBasket = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const customerID = customerId(res);
    if (customerID === undefined) return;
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Product and quantity must be positive whole numbers.',
      });
      return;
    }
    const { productID, quantity } = parsed.data;

    const basketItem = await this.basketService.addToBasket(
      customerID,
      productID,
      quantity,
    );

    res.status(201).json(basketItem);
  };
  private readonly updateQuantity = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const customerID = customerId(res);
    if (customerID === undefined) return;
    const basketID = idParam.safeParse(req.params.basketID);
    const input = quantitySchema.safeParse(req.body);
    if (!basketID.success || !input.success) {
      res.status(400).json({ error: 'Invalid basket quantity update.' });
      return;
    }
    const item = await this.basketService.updateQuantity(
      customerID,
      basketID.data,
      input.data,
    );

    res.json(item);
  };

  private readonly removeFromBasket = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const customerID = customerId(res);
    if (customerID === undefined) return;
    const basketID = idParam.safeParse(req.params.basketID);
    if (!basketID.success) {
      res.status(400).json({ error: 'Invalid basket item ID.' });
      return;
    }
    const item = await this.basketService.removeFromBasket(
      customerID,
      basketID.data,
    );

    res.json(item);
  };

  router(): Router {
    const router = Router();
    router.use('/basket', (_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });

    router.get('/basket/:customerID', this.getBasket);
    router.post('/basket', this.addToBasket);
    router.put('/basket/:basketID', this.updateQuantity);
    router.delete('/basket/:basketID', this.removeFromBasket);
    router.use(
      (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (error instanceof BasketError) {
          res.status(error.status).json({ error: error.message });
          return;
        }
        console.error('Basket request failed', error);
        next(error);
      },
    );

    return router;
  }
}
