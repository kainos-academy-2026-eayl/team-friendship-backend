import { describe, expect, test, vi } from 'vitest';
import type { OrderWithServices } from '../../src/repositories/orderRepository';
import {
  OrderNotFoundError,
  OrderService,
} from '../../src/services/orderService';

function order(customerID: number): OrderWithServices {
  return {
    orderID: 7,
    customerID,
    dateCreated: new Date('2026-11-04T12:00:00Z'),
    status: 'pending',
    address: '123 Town Street',
    postcode: 'BT16 AAA',
    orderServices: [],
  };
}

function createService(found: OrderWithServices | null = order(1)) {
  const repository = {
    create: vi.fn(async () => order(1)),
    findById: vi.fn(async () => found),
    findByCustomerId: vi.fn(async () => [order(1)]),
  };
  return { service: new OrderService(repository), repository };
}

describe('OrderService', () => {
  test('createOrder passes the customer and items to the repository', async () => {
    const { service, repository } = createService();
    const items = [{ productID: 3, quantity: 2 }];

    await expect(service.createOrder(1, items)).resolves.toEqual(order(1));
    expect(repository.create).toHaveBeenCalledWith(1, items, undefined);
  });

  test('createOrder passes an alternative delivery address to the repository', async () => {
    const { service, repository } = createService();
    const items = [{ productID: 3, quantity: 2 }];
    const deliveryAddress = { address: '14 Gift Lane', postcode: 'BT9 5AB' };

    await service.createOrder(1, items, deliveryAddress);
    expect(repository.create).toHaveBeenCalledWith(1, items, deliveryAddress);
  });

  test('getOrderForCustomer returns an order owned by the customer', async () => {
    const { service } = createService();

    await expect(service.getOrderForCustomer(7, 1)).resolves.toEqual(order(1));
  });

  test('getOrderForCustomer throws when the order does not exist', async () => {
    const { service } = createService(null);

    await expect(service.getOrderForCustomer(7, 1)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });

  test('getOrderForCustomer hides orders owned by another customer', async () => {
    const { service } = createService(order(2));

    await expect(service.getOrderForCustomer(7, 1)).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });

  test('listOrdersForCustomer returns the customer orders', async () => {
    const { service, repository } = createService();

    await expect(service.listOrdersForCustomer(1)).resolves.toEqual([order(1)]);
    expect(repository.findByCustomerId).toHaveBeenCalledWith(1);
  });
});
