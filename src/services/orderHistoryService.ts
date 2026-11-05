import type { OrderHistoryRepository } from '../repositories/orderHistoryRepository';

export class OrderHistoryNotFoundError extends Error {
  constructor(customerID: number) {
    super(`No order history found for customer ${customerID}`);
    this.name = 'OrderHistoryNotFoundError';
  }
}

type OrderHistoryRepositoryContract = Pick<
  OrderHistoryRepository,
  'findOrderHistoryByCustomerID'
>;

export class OrderHistoryService {
  constructor(private readonly repository: OrderHistoryRepositoryContract) {}

  async getOrderHistoryByCustomerID(customerID: number) {
    const orders =
      await this.repository.findOrderHistoryByCustomerID(customerID);

    if (orders.length === 0) {
      throw new OrderHistoryNotFoundError(customerID);
    }

    return orders;
  }
}
