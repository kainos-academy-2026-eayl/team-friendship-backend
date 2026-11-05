import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  ProductNotFoundError,
  ProductService,
} from '../../src/services/productService';

const product = {
  productID: 40,
  productName: 'Marble',
  productDescription: 'Bold and shiny, perfect for all your taskmaster needs',
  productCategory: 'Toys',
  productPrice: 30.88,
  productImage: 'products_images/marble.jpeg',
  productStock: 10,
};

test('getProductById returns a product when it exists', async () => {
  const repository = {
    async findAll() {
      return [];
    },
    async findById(productID: number) {
      return productID === 40 ? product : null;
    },
  };

  const service = new ProductService(repository);

  const result = await service.getProductById(40);

  assert.deepEqual(result, product);
});

test('getProductById throws ProductNotFoundError when product does not exist', async () => {
  const repository = {
    async findAll() {
      return [];
    },
    async findById() {
      return null;
    },
  };

  const service = new ProductService(repository);

  await assert.rejects(() => service.getProductById(999), ProductNotFoundError);
});

test('getProductById throws ProductNotFoundError when the repository returns null', async () => {
  const repository = {
    async findAll() {
      return [];
    },
    async findById() {
      return null;
    },
  };

  const service = new ProductService(repository);

  await assert.rejects(
    () => service.getProductById(999),
    (error: unknown) => {
      assert.ok(error instanceof ProductNotFoundError);
      assert.equal(error.message, 'Product 999 not found');
      return true;
    },
  );
});
