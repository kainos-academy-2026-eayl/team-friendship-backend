import type { Order, OrderService } from '../generated/prisma/client';
import type { OrderRepository } from '../repositories/orderRepository';

export interface CreateOrderInput {
  customerID: number;
  status: string;
  orderServices: {
    productID: number;
    quantity: number;
  }[];
}

export class OrderNotFoundError extends Error {
  constructor(orderID: number) {
    super(`Order ${orderID} not found`);
    this.name = 'OrderNotFoundError';
  }
}

export class CustomerNotFoundError extends Error {
  constructor(customerID: number) {
    super(`Customer ${customerID} not found`);
    this.name = 'CustomerNotFoundError';
  }
}

type OrderRepositoryContract = Pick<
  OrderRepository,
  'create' | 'findById' | 'findByCustomerId'
>;

export class OrderServiceImpl {
  constructor(private readonly repository: OrderRepositoryContract) {}

  async createOrder(
    input: CreateOrderInput,
  ): Promise<Order & { orderServices: OrderService[] }> {
    if (!input.orderServices || input.orderServices.length === 0) {
      throw new Error('Order must contain at least one service');
    }
    return this.repository.create(input);
  }

  async getOrderById(
    orderID: number,
    customerID: number,
  ): Promise<Order & { orderServices: OrderService[] }> {
    const order = await this.repository.findById(orderID, customerID);
    if (!order) {
      throw new OrderNotFoundError(orderID);
    }
    return order;
  }

  async getCustomerOrders(
    customerID: number,
  ): Promise<(Order & { orderServices: OrderService[] })[]> {
    return this.repository.findByCustomerId(customerID);
  }
}
