import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrismaClient } from '../../src/db/prisma';
import { OrderRepository } from '../../src/repositories/orderRepository';
import { OrderServiceImpl } from '../../src/services/orderService';

describe.skipIf(!process.env.DATABASE_URL)('Order Service', () => {
  let orderRepository: OrderRepository;
  let orderService: OrderServiceImpl;

  beforeAll(async () => {
    const prisma = getPrismaClient();
    orderRepository = new OrderRepository(prisma);
    orderService = new OrderServiceImpl(orderRepository);
  });

  afterAll(async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });

  it('should create an order with order services', async () => {
    const order = await orderService.createOrder({
      customerID: 1,
      status: 'pending',
      orderServices: [
        { productID: 1, quantity: 2 },
        { productID: 2, quantity: 1 },
      ],
    });

    expect(order).toBeDefined();
    expect(order.orderID).toBeDefined();
    expect(order.customerID).toBe(1);
    expect(order.status).toBe('pending');
    expect(order.orderServices).toHaveLength(2);
  });

  it('should retrieve an order by ID', async () => {
    const order = await orderService.getOrderById(1);

    expect(order).toBeDefined();
    expect(order.orderID).toBe(1);
    expect(order.orderServices).toBeDefined();
  });

  it('should retrieve all orders for a customer', async () => {
    const orders = await orderService.getCustomerOrders(1);

    expect(orders).toBeDefined();
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
  });

  it('should throw OrderNotFoundError for non-existent order', async () => {
    await expect(orderService.getOrderById(99999)).rejects.toThrow(
      'Order 99999 not found',
    );
  });

  it('should throw error for empty order services', async () => {
    await expect(
      orderService.createOrder({
        customerID: 1,
        status: 'pending',
        orderServices: [],
      }),
    ).rejects.toThrow('Order must contain at least one service');
  });
});
