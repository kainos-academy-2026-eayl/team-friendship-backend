import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { onTestFinished, test } from 'vitest';

import { ProductController } from '../../src/controllers/productController';
import { ProductNotFoundError } from '../../src/services/productService';

const product = {
  productID: 40,
  productName: 'Marble',
  productDescription: 'Bold and shiny, perfect for all your taskmaster needs',
  productCategory: 'Toys',
  productPrice: 30.88,
  productImage: 'products_images/marble.jpeg',
  productStock: 10,
};

async function requestProduct(
  service: ConstructorParameters<typeof ProductController>[0],
  productId: string,
): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const app = express();

  const controller = new ProductController(service);

  app.use(controller.router());

  const server = app.listen(0, '127.0.0.1');

  onTestFinished(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  await once(server, 'listening');

  const address = server.address();

  assert.ok(address && typeof address !== 'string');

  const response = await fetch(
    `http://127.0.0.1:${address.port}/products/${productId}`,
  );

  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

test('GET /products/:id returns the requested product', async () => {
  const service = {
    async getAllProducts() {
      return [];
    },
    async getProductById(productID: number) {
      if (productID === 40) {
        return product;
      }

      throw new ProductNotFoundError(productID);
    },
  };

  const response = await requestProduct(service, '40');

  assert.equal(response.status, 200);

  assert.deepEqual(response.body, {
    product,
  });
});

test('GET /products/:id rejects non-numeric product ids', async () => {
  const service = {
    async getAllProducts() {
      return [];
    },
    async getProductById() {
      throw new Error('Should not be called');
    },
  };

  const response = await requestProduct(service, 'abc');

  assert.equal(response.status, 400);

  assert.deepEqual(response.body, {
    error: 'Invalid product request',
    details: {
      id: ['Product id must be a number'],
    },
  });
});

test('GET /products/:id returns 404 when product is missing', async () => {
  const service = {
    async getAllProducts() {
      return [];
    },
    async getProductById(productID: number) {
      throw new ProductNotFoundError(productID);
    },
  };

  const response = await requestProduct(service, '999');

  assert.equal(response.status, 404);

  assert.deepEqual(response.body, {
    error: 'Product 999 not found',
  });
});

test('GET /products/:id returns 500 for unexpected errors', async () => {
  const service = {
    async getAllProducts() {
      return [];
    },
    async getProductById() {
      throw new Error('Database failure');
    },
  };

  const response = await requestProduct(service, '40');

  assert.equal(response.status, 500);

  assert.deepEqual(response.body, {
    error: 'Internal server error',
  });
});
