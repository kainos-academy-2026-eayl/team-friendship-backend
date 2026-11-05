import { type Request, type Response, Router } from 'express';
import type { BasketService } from '../services/basketService';

export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  private readonly getBasket = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    console.log('Basket endpoint hit');

    const customerID = Number(req.params.customerID);

    const basket = await this.basketService.getBasket(customerID);

    res.json({ basket });
  };

  router(): Router {
    const router = Router();

    router.get('/basket/:customerID', this.getBasket);

    return router;
  }
}
