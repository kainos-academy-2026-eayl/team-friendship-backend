import type { Product } from '../generated/prisma/client';
import type { ProductRepository } from '../repositories/productRepository';

export class ProductNotFoundError extends Error {
  constructor(productID: number) {
    super(`Product ${productID} not found`);
    this.name = 'ProductNotFoundError';
  }
}

type ProductRepositoryContract = Pick<ProductRepository, 'findById'>;

export class DisplayProduct {
  constructor(public readonly repository: ProductRepositoryContract) {}

  async getProductById(productID: number): Promise<Product> {
    const product = await this.repository.findById(productID);
    if (!product) {
      throw new ProductNotFoundError(productID);
    }
    return product;
  }
}
