import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    DisplayProduct,
    ProductNotFoundError,
} from '../../src/services/productDisplayService';

const product = {
    productID: 40,
    productName: 'Marble',
    productDescription: 'Bold and shiny, perfect for all your taskmaster needs',
    productPrice: 30.88,
    productImage: 'products_images/marble.jpeg',
    productStock: 10,
};

test('getProductById returns a product when it exists', async () => {
    const repository = {
        async findById(productID: number) {
            return productID === 40 ? product : null;
        },
    };

    const service = new DisplayProduct(repository);

    const result = await service.getProductById(40);

    assert.deepEqual(result, product);
});

test('getProductById throws ProductNotFoundError when product does not exist', async () => {
    const repository = {
        async findById() {
            return null;
        },
    };

    const service = new DisplayProduct(repository);

    await assert.rejects(() => service.getProductById(999), ProductNotFoundError);
});
