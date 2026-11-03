import type { PrismaClient, Product } from '../generated/prisma/client';

export class ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll(): Promise<Product[]> {
    return this.prisma.product.findMany({ orderBy: { productID: 'asc' } });
  }

  findById(productID: number): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { productID } });
  }
}
