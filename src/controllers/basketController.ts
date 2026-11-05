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
  private readonly updateQuantity = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    console.log('update quantity endpoint hit');

    const basketID = Number(req.params.basketID);
    const { quantity } = req.body;

    const item = await this.basketService.updateQuantity(basketID, quantity);

    res.json(item);
  };

  private readonly removeFromBasket = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const basketID = Number(req.params.basketID);

    const item = await this.basketService.removeFromBasket(basketID);

    res.json(item);
  };

  router(): Router {
    const router = Router();

    router.get('/basket/:customerID', this.getBasket);
    router.post('/basket', this.addToBasket);
    router.put('/basket/:basketID', this.updateQuantity);
    router.delete('/basket/:basketID', this.removeFromBasket);

    return router;
  }
}
