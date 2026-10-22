import assert from 'node:assert/strict'
import { beforeEach, test } from 'vitest'
import type { Customer, Product } from '../generated/prisma/client'
import type { BasketItemWithProduct } from '../repositories/basketRepository'
import { BasketError, BasketService } from './basketService'

const customer = { customerID: 1 } as Customer
const product: Product = {
  productID: 10,
  productName: 'Mug',
  productDescription: 'A mug',
  productPrice: 4.99,
  productStock: 5,
}

let items: Map<string, BasketItemWithProduct>
let service: BasketService

const key = (customerID: number, productID: number) =>
  `${customerID}:${productID}`

beforeEach(() => {
  items = new Map()
  service = new BasketService({
    findCustomerById: async (id) =>
      id === customer.customerID ? customer : null,
    findProductById: async (id) => (id === product.productID ? product : null),
    findItemsByCustomer: async (id) =>
      [...items.values()].filter((i) => i.customerID === id),
    findItem: async (c, p) => items.get(key(c, p)) ?? null,
    upsertItem: async (c, p, quantity) => {
      const item = { customerID: c, productID: p, quantity, product }
      items.set(key(c, p), item)
      return item
    },
    deleteItem: async (c, p) => {
      items.delete(key(c, p))
    },
    deleteAllItems: async (c) => {
      for (const [k, i] of items) if (i.customerID === c) items.delete(k)
    },
  })
})

async function assertBasketError(
  promise: Promise<unknown>,
  statusCode: number,
) {
  await assert.rejects(
    promise,
    (error) => error instanceof BasketError && error.statusCode === statusCode,
  )
}

test('adding the same product twice accumulates quantity and totals', async () => {
  await service.addItem(1, 10, 2)
  await service.addItem(1, 10, 1)

  const basket = await service.getBasket(1)
  assert.equal(basket.items.length, 1)
  assert.equal(basket.totalItems, 3)
  assert.equal(basket.totalPrice, 14.97)
})

test('rejects quantities that exceed stock', async () => {
  await service.addItem(1, 10, 4)
  await assertBasketError(service.addItem(1, 10, 2), 409)
  await assertBasketError(service.updateItemQuantity(1, 10, 6), 409)
})

test('rejects invalid quantity and unknown customer or product', async () => {
  await assertBasketError(service.addItem(1, 10, 0), 400)
  await assertBasketError(service.addItem(1, 10, 1.5), 400)
  await assertBasketError(service.addItem(99, 10, 1), 404)
  await assertBasketError(service.addItem(1, 99, 1), 404)
})

test('updates, removes and clears items', async () => {
  await service.addItem(1, 10, 1)
  const updated = await service.updateItemQuantity(1, 10, 3)
  assert.equal(updated.quantity, 3)

  await service.removeItem(1, 10)
  await assertBasketError(service.removeItem(1, 10), 404)

  await service.addItem(1, 10, 1)
  await service.clearBasket(1)
  assert.equal((await service.getBasket(1)).items.length, 0)
})
