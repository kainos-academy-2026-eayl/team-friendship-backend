import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import {
  InsufficientStockError,
  OrderNotFoundError,
  OrderProductNotFoundError,
  type OrderService,
} from '../services/orderService';

const MAX_ORDER_LINES = 50;

function positiveId(label: string) {
  return z
    .int32({ error: `${label} must be a whole number` })
    .positive({ error: `${label} must be positive` });
}

function positiveIdParam(label: string) {
  return z.coerce
    .number({ error: `${label} must be a number` })
    .pipe(positiveId(label));
}

export const createOrderSchema = z.object({
  customerID: positiveId('Customer id'),
  orderServices: z
    .array(
      z.object({
        productID: positiveId('Product id'),
        quantity: positiveId('Quantity'),
      }),
    )
    .min(1, { error: 'Order must contain at least one product' })
    .max(MAX_ORDER_LINES, {
      error: `Order cannot contain more than ${MAX_ORDER_LINES} products`,
    })
    .refine(
      (items) =>
        new Set(items.map((item) => item.productID)).size === items.length,
      { error: 'Each product may only appear once per order' },
    ),
});

export const orderIdSchema = z.object({ id: positiveIdParam('Order id') });
export const userIdSchema = z.object({ id: positiveIdParam('User id') });

type OrderServiceContract = Pick<
  OrderService,
  'createOrder' | 'getOrderForCustomer' | 'listOrdersForCustomer'
>;

function validationError(res: Response, message: string, error: z.ZodError) {
  res.status(400).json({
    error: message,
    details: z.flattenError(error),
  });
}

// Defensive check in case the router is mounted without the auth middleware.
function authenticatedCustomer(res: Response): number | undefined {
  const customerId = res.locals.customerId;
  if (customerId === undefined) {
    res.status(401).json({ error: 'Authentication required' });
  }
  return customerId;
}

function forbidden(res: Response): void {
  res.status(403).json({ error: 'You can only access your own orders' });
}

export class OrderController {
  constructor(private readonly service: OrderServiceContract) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const customerId = authenticatedCustomer(res);
    if (customerId === undefined) return;

    const result = createOrderSchema.safeParse(req.body);
    if (!result.success) {
      validationError(res, 'Invalid order request', result.error);
      return;
    }
    if (result.data.customerID !== customerId) {
      forbidden(res);
      return;
    }

    const order = await this.service.createOrder(
      customerId,
      result.data.orderServices,
    );
    res.status(201).location(`/orders/${order.orderID}`).json({ order });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const customerId = authenticatedCustomer(res);
    if (customerId === undefined) return;

    const result = orderIdSchema.safeParse(req.params);
    if (!result.success) {
      validationError(res, 'Invalid order request', result.error);
      return;
    }

    const order = await this.service.getOrderForCustomer(
      result.data.id,
      customerId,
    );
    res.status(200).json({ order });
  };

  listForUser = async (req: Request, res: Response): Promise<void> => {
    const customerId = authenticatedCustomer(res);
    if (customerId === undefined) return;

    const result = userIdSchema.safeParse(req.params);
    if (!result.success) {
      validationError(res, 'Invalid user request', result.error);
      return;
    }
    if (result.data.id !== customerId) {
      forbidden(res);
      return;
    }

    const orders = await this.service.listOrdersForCustomer(customerId);
    res.status(200).json({ orders });
  };

  router(): Router {
    const router = Router();

    router.post('/orders', this.create);
    router.get('/orders/:id', this.getById);
    router.get('/users/:id/orders', this.listForUser);

    // Express 5 forwards rejected promises from async handlers to this error handler.
    router.use(
      (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
          next(error);
          return;
        }
        if (error instanceof OrderNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof OrderProductNotFoundError) {
          res
            .status(400)
            .json({ error: error.message, productID: error.productID });
          return;
        }
        if (error instanceof InsufficientStockError) {
          res
            .status(409)
            .json({ error: error.message, productID: error.productID });
          return;
        }
        console.error('Unexpected order error', error);
        res.status(500).json({ error: 'Internal server error' });
      },
    );

    return router;
  }
}
