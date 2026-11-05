import { type Request, type Response, Router } from 'express';
import type { BasketService } from '../services/basketService';

export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  private readonly getBasket = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const customerID = Number(req.params.customerID);

    const basket = await this.basketService.getBasket(customerID);

    res.json({ basket });
  };

  private readonly addToBasket = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const { customerID, productID, quantity } = req.body;

    const basketItem = await this.basketService.addToBasket(
      customerID,
      productID,
      quantity,
    );

    res.status(201).json(basketItem);
  };

  router(): Router {
    const router = Router();

    router.get('/basket/:customerID', this.getBasket);
    router.post('/basket', this.addToBasket);

    return router;
  }
}
