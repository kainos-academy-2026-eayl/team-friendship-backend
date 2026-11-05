import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import {
  OrderHistoryNotFoundError,
  type OrderHistoryService,
} from '../services/orderHistoryService';

export const customerIdSchema = z.object({
  customerID: z.coerce
    .number({ error: 'Customer id must be a number' })
    .int({ error: 'Customer id must be a whole number' })
    .positive({ error: 'Customer id must be positive' }),
});

type OrderHistoryServiceContract = Pick<
  OrderHistoryService,
  'getOrderHistoryByCustomerID'
>;

export class OrderHistoryController {
  constructor(private readonly service: OrderHistoryServiceContract) {}

  getByCustomerId = async (req: Request, res: Response): Promise<void> => {
    const result = customerIdSchema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        error: 'Invalid order history request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    const principal = res.locals.principal;
    if (
      principal?.type !== 'customer' ||
      result.data.customerID !== principal.id
    ) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const orderHistory = await this.service.getOrderHistoryByCustomerID(
      result.data.customerID,
    );

    const orders = orderHistory.flatMap((order) =>
      order.orderServices.map((orderService) => ({
        orderId: order.orderID,
        date: order.dateCreated.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        product: orderService.product.productName,
        quantity: orderService.quantity,
        status: order.status,
      })),
    );

    res.status(200).json({ orders });
  };

  router(): Router {
    const router = Router();

    router.get('/order-history/:customerID', this.getByCustomerId);

    // Express 5 forwards rejected promises from async handlers to this error handler.
    router.use(
      (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
          next(error);
          return;
        }

        if (error instanceof OrderHistoryNotFoundError) {
          res.status(404).json({
            error: error.message,
          });
          return;
        }

        console.error('Unexpected order history error', error);

        res.status(500).json({
          error: 'Internal server error',
        });
      },
    );

    return router;
  }
}
