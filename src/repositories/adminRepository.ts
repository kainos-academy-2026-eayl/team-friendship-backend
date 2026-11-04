import { Prisma, type PrismaClient } from '../generated/prisma/client';

export type AdminPeriod = 'today' | 'week' | 'month';

export type LowStockProduct = {
  productID: number;
  productName: string;
  productStock: number;
};

export type AdminDashboard = {
  period: AdminPeriod;
  totalOrders: number;
  revenue: number;
  currency: 'GBP';
  lowStockProducts: LowStockProduct[];
};

export class AdminProductNotFoundError extends Error {
  constructor(productID: number) {
    super(`Product ${productID} not found`);
    this.name = 'AdminProductNotFoundError';
  }
}

export class AdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getDashboard(period: AdminPeriod): Promise<AdminDashboard> {
    const [metrics, lowStockProducts] = await Promise.all([
      this.prisma.$queryRaw<
        { totalOrders: number; revenue: number }[]
      >(Prisma.sql`
        SELECT
          COUNT(DISTINCT orders."orderID")::INTEGER AS "totalOrders",
          COALESCE(SUM(order_lines.quantity * order_lines."unitPrice"), 0)::DOUBLE PRECISION AS revenue
        FROM "Order" AS orders
        LEFT JOIN "OrderService" AS order_lines
          ON order_lines."orderID" = orders."orderID"
        WHERE orders."dateCreated" >= (
          (CASE ${period}
            WHEN 'today' THEN date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')
            WHEN 'week' THEN date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')
            WHEN 'month' THEN date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')
            END AT TIME ZONE 'Europe/London') AT TIME ZONE 'UTC'
        )
          AND orders."dateCreated" <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
          AND lower(orders.status) IN ('paid', 'completed')
      `),
      this.prisma.product.findMany({
        where: { productStock: { gte: 0, lt: 5 } },
        select: {
          productID: true,
          productName: true,
          productStock: true,
        },
        orderBy: [{ productStock: 'asc' }, { productName: 'asc' }],
      }),
    ]);

    return {
      period,
      totalOrders: metrics[0]?.totalOrders ?? 0,
      revenue: metrics[0]?.revenue ?? 0,
      currency: 'GBP',
      lowStockProducts,
    };
  }

  async reorderStock(productID: number): Promise<LowStockProduct> {
    try {
      return await this.prisma.product.update({
        where: { productID },
        data: { productStock: { increment: 20 } },
        select: {
          productID: true,
          productName: true,
          productStock: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new AdminProductNotFoundError(productID);
      }
      throw error;
    }
  }
}
