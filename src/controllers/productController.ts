import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from 'express';
import { z } from 'zod';
import {
  ProductNotFoundError,
  type ProductService,
} from '../services/productService';

export const productIdSchema = z.object({
  id: z.coerce
    .number({ error: 'Product id must be a number' })
    .int({ error: 'Product id must be a whole number' })
    .positive({ error: 'Product id must be positive' }),
});

type ProductServiceContract = Pick<
  ProductService,
  'getAllProducts' | 'getProductById'
>;

export class ProductController {
  constructor(private readonly service: ProductServiceContract) {}

  getAll = async (_req: Request, res: Response): Promise<void> => {
    const products = await this.service.getAllProducts();
    res.status(200).json({ products });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const result = productIdSchema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid product request',
        details: z.flattenError(result.error).fieldErrors,
      });
      return;
    }

    const product = await this.service.getProductById(result.data.id);
    res.status(200).json({ product });
  };

  router(): Router {
    const router = Router();

    router.get('/products', this.getAll);
    router.get('/products/:id', this.getById);

    // Express 5 forwards rejected promises from async handlers to this error handler.
    router.use(
      (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
          next(error);
          return;
        }
        if (error instanceof ProductNotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        console.error('Unexpected product error', error);
        res.status(500).json({ error: 'Internal server error' });
      },
    );

    return router;
  }
}
