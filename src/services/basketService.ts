import type {
  BasketRepository,
  BasketItemWithProduct,
} from '../repositories/basketRepository'

export class BasketError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'BasketError'
  }
}

export type BasketItemDto = {
  productID: number
  productName: string
  productPrice: number
  quantity: number
  lineTotal: number
}

export type BasketDto = {
  customerID: number
  items: BasketItemDto[]
  totalItems: number
  totalPrice: number
}

type BasketRepositoryContract = Pick<
  BasketRepository,
  | 'findCustomerById'
  | 'findItemsByCustomer'
  | 'findItem'
  | 'addItemWithStock'
  | 'upsertItem'
  | 'deleteItem'
  | 'deleteAllItems'
>

const roundToPence = (value: number): number => Math.round(value * 100) / 100

function toItemDto(item: BasketItemWithProduct): BasketItemDto {
  return {
    productID: item.productID,
    productName: item.product.productName,
    productPrice: item.product.productPrice,
    quantity: item.quantity,
    lineTotal: roundToPence(item.product.productPrice * item.quantity),
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new BasketError(`${field} must be a positive integer`, 400)
  }
}

export class BasketService {
  constructor(private readonly repository: BasketRepositoryContract) {}

  async getBasket(customerID: number): Promise<BasketDto> {
    await this.ensureCustomerExists(customerID)
    const items = (await this.repository.findItemsByCustomer(customerID)).map(
      toItemDto,
    )

    return {
      customerID,
      items,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      totalPrice: roundToPence(
        items.reduce((sum, item) => sum + item.lineTotal, 0),
      ),
    }
  }

  async addItem(
    customerID: number,
    productID: number,
    quantity: number,
  ): Promise<BasketItemDto> {
    assertPositiveInteger(quantity, 'quantity')
    await this.ensureCustomerExists(customerID)
    const result = await this.repository.addItemWithStock(
      customerID,
      productID,
      quantity,
    )
    if (result.kind === 'product-not-found') {
      throw new BasketError(`Product ${productID} not found`, 404)
    }
    if (result.kind === 'insufficient-stock') {
      throw new BasketError(`Only ${result.stock} item(s) in stock`, 409)
    }
    return toItemDto(result.item)
  }

  async updateItemQuantity(
    customerID: number,
    productID: number,
    quantity: number,
  ): Promise<BasketItemDto> {
    assertPositiveInteger(quantity, 'quantity')
    await this.ensureCustomerExists(customerID)
    const item = await this.ensureItemInBasket(customerID, productID)
    this.ensureStockAvailable(item.product.productStock, quantity)

    return toItemDto(
      await this.repository.upsertItem(customerID, productID, quantity),
    )
  }

  async removeItem(customerID: number, productID: number): Promise<void> {
    await this.ensureCustomerExists(customerID)
    await this.ensureItemInBasket(customerID, productID)
    await this.repository.deleteItem(customerID, productID)
  }

  async clearBasket(customerID: number): Promise<void> {
    await this.ensureCustomerExists(customerID)
    await this.repository.deleteAllItems(customerID)
  }

  private async ensureCustomerExists(customerID: number): Promise<void> {
    if (!(await this.repository.findCustomerById(customerID))) {
      throw new BasketError(`Customer ${customerID} not found`, 404)
    }
  }

  private async ensureItemInBasket(customerID: number, productID: number) {
    const item = await this.repository.findItem(customerID, productID)
    if (!item) {
      throw new BasketError(`Product ${productID} is not in the basket`, 404)
    }
    return item
  }

  private ensureStockAvailable(stock: number, requested: number): void {
    if (requested > stock) {
      throw new BasketError(`Only ${stock} item(s) in stock`, 409)
    }
  }
}
