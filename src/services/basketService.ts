import type { Basket } from '../generated/prisma/client';
import type { BasketRepository } from '../repositories/basketRepository';

export class BasketService {
  constructor(private readonly basketRepository: BasketRepository) {}

  getBasket(customerID: number): Promise<Basket[]> {
    return this.basketRepository.findAll(customerID);
  }

  addToBasket(
    customerID: number,
    productID: number,
    quantity: number,
  ): Promise<Basket> {
    return this.basketRepository.addItem(customerID, productID, quantity);
  }

  removeFromBasket(basketID: number): Promise<Basket> {
    return this.basketRepository.removeItem(basketID);
  }
}
