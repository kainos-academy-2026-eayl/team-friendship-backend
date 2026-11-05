import { type Request, type Response, Router } from 'express';
import { findDiscount } from '../models/discountModel';

export class DiscountController {
  getByCode = (req: Request, res: Response): void => {
    const code = req.params.code;
    const discount =
      typeof code === 'string' && code.length <= 50
        ? findDiscount(code)
        : undefined;
    if (!discount) {
      res.status(404).json({ error: 'Invalid discount code' });
      return;
    }
    res.status(200).json({ discount });
  };

  router(): Router {
    const router = Router();

    router.get('/discounts/:code', this.getByCode);

    return router;
  }
}
