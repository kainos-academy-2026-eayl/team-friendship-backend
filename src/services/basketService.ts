import type { Basket } from '../generated/prisma/client';
import type { BasketQuantityChange } from '../models/basketModel';
import type { BasketRepository } from '../repositories/basketRepository';

export class BasketService {
  constructor(
    private readonly basketRepository: Pick<
      BasketRepository,
      'findAll' | 'addItem' | 'updateQuantity' | 'removeItem'
    >,
  ) {}

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

  updateQuantity(
    customerID: number,
    basketID: number,
    input: BasketQuantityChange,
  ): Promise<Basket> {
    return this.basketRepository.updateQuantity(customerID, basketID, input);
  }

  removeFromBasket(customerID: number, basketID: number): Promise<Basket> {
    return this.basketRepository.removeItem(customerID, basketID);
  }
}
