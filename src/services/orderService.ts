import type { Discount } from '../models/discountModel';
import type { DeliveryAddress, OrderItem } from '../models/orderModel';
import type { DiscountCodeRepository } from '../repositories/discountCodeRepository';
import type {
  OrderRepository,
  OrderWithServices,
} from '../repositories/orderRepository';

export class OrderNotFoundError extends Error {
  constructor(orderID: number) {
    super(`Order ${orderID} not found`);
    this.name = 'OrderNotFoundError';
  }
}

export class OrderProductNotFoundError extends Error {
  constructor(readonly productID: number) {
    super(`Product ${productID} not found`);
    this.name = 'OrderProductNotFoundError';
  }
}

export class InsufficientStockError extends Error {
  constructor(readonly productID: number) {
    super(`Not enough stock for product ${productID}`);
    this.name = 'InsufficientStockError';
  }
}

type OrderRepositoryContract = Pick<
  OrderRepository,
  'create' | 'findById' | 'findByCustomerId'
>;
type DiscountLookup = Pick<DiscountCodeRepository, 'findUsableByCode'>;

export class InvalidDiscountCodeError extends Error {
  constructor() {
    super('Invalid discount code');
    this.name = 'InvalidDiscountCodeError';
  }
}

export class OrderService {
  constructor(
    private readonly repository: OrderRepositoryContract,
    private readonly discounts: DiscountLookup,
  ) {}

  async createOrder(
    customerID: number,
    items: OrderItem[],
    deliveryAddress?: DeliveryAddress,
    discountCode?: string,
  ): Promise<OrderWithServices> {
    let discount: Discount | undefined;
    if (discountCode !== undefined) {
      discount =
        (await this.discounts.findUsableByCode(discountCode)) ?? undefined;
      if (!discount) {
        throw new InvalidDiscountCodeError();
      }
    }
    return this.repository.create(customerID, items, deliveryAddress, discount);
  }

  // Orders belonging to other customers are reported as missing so their existence is not revealed.
  async getOrderForCustomer(
    orderID: number,
    customerID: number,
  ): Promise<OrderWithServices> {
    const order = await this.repository.findById(orderID);
    if (!order || order.customerID !== customerID) {
      throw new OrderNotFoundError(orderID);
    }
    return order;
  }

  listOrdersForCustomer(customerID: number): Promise<OrderWithServices[]> {
    return this.repository.findByCustomerId(customerID);
  }
}
