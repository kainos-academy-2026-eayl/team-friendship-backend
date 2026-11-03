import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import {
  OrderNotFoundError,
  type OrderServiceImpl,
} from '../services/orderService';

const createOrderSchema = z.object({
  customerID: z
    .number({ error: 'Customer ID must be a number' })
    .int({ error: 'Customer ID must be a whole number' })
    .positive({ error: 'Customer ID must be positive' }),
  status: z
    .string({ error: 'Status must be a string' })
    .min(1, { message: 'Status cannot be empty' }),
  orderServices: z
    .array(
      z.object({
        productID: z
          .number({ error: 'Product ID must be a number' })
          .int({ error: 'Product ID must be a whole number' })
          .positive({ error: 'Product ID must be positive' }),
        quantity: z
          .number({ error: 'Quantity must be a number' })
          .int({ error: 'Quantity must be a whole number' })
          .positive({ error: 'Quantity must be positive' }),
      }),
    )
    .min(1, { message: 'Order must contain at least one service' })
    .refine(
      (services) =>
        new Set(services.map((service) => service.productID)).size ===
        services.length,
      { message: 'Each product may appear only once in an order' },
    ),
});

const orderIdSchema = z.object({
  id: z.coerce
    .number({ error: 'Order ID must be a number' })
    .int({ error: 'Order ID must be a whole number' })
    .positive({ error: 'Order ID must be positive' }),
});

const customerIdSchema = z.object({
  id: z.coerce
    .number({ error: 'Customer ID must be a number' })
    .int({ error: 'Customer ID must be a whole number' })
    .positive({ error: 'Customer ID must be positive' }),
});

type OrderServiceContract = Pick<
  OrderServiceImpl,
  'createOrder' | 'getOrderById' | 'getCustomerOrders'
>;

export class OrderController {
  constructor(private readonly service: OrderServiceContract) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const result = createOrderSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid order request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    const order = await this.service.createOrder(result.data);
    res.status(201).json({ order });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = orderIdSchema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid order request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    const order = await this.service.getOrderById(result.data.id);
    res.status(200).json({ order });
  };

  getByCustomerId = async (req: Request, res: Response): Promise<void> => {
    const result = customerIdSchema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid customer request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    const orders = await this.service.getCustomerOrders(result.data.id);
    res.status(200).json({ orders });
  };

  router(): Router {
    const router = Router();

    router.post('/orders', this.create);
    router.get('/orders/:id', this.getById);
    router.get('/users/:id/orders', this.getByCustomerId);

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
        console.error('Unexpected order error', error);
        res.status(500).json({ error: 'Internal server error' });
      },
    );

    return router;
  }
}
