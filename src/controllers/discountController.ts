import { type Request, type Response, Router } from 'express';
import type { DiscountCodeRepository } from '../repositories/discountCodeRepository';

type DiscountLookup = Pick<DiscountCodeRepository, 'findUsableByCode'>;

export class DiscountController {
  constructor(private readonly discounts: DiscountLookup) {}

  getByCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const code = req.params.code;
      const discount =
        typeof code === 'string'
          ? await this.discounts.findUsableByCode(code)
          : null;
      if (!discount) {
        res.status(404).json({ error: 'Invalid discount code' });
        return;
      }
      res.status(200).json({
        discount: { code: discount.code, percentOff: discount.percentOff },
      });
    } catch (error) {
      console.error('Unable to look up discount code', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  router(): Router {
    const router = Router();

    router.get('/discounts/:code', this.getByCode);

    return router;
  }
}
