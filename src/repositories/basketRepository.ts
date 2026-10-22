import { PrismaPg } from '@prisma/adapter-pg'
import {
  PrismaClient,
  type Customer,
  type Product,
} from '../generated/prisma/client'

export type BasketItemWithProduct = {
  customerID: number
  productID: number
  quantity: number
  product: Product
}

export type BasketAddItemResult =
  | { kind: 'added'; item: BasketItemWithProduct }
  | { kind: 'product-not-found' }
  | { kind: 'insufficient-stock'; stock: number }

let prismaClient: PrismaClient | undefined

function isTransactionConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  )
}

function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    prismaClient = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    })
  }
  return prismaClient
}

export class BasketRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  findCustomerById(customerID: number): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { customerID } })
  }

  findProductById(productID: number): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { productID } })
  }

  findItemsByCustomer(customerID: number): Promise<BasketItemWithProduct[]> {
    return this.prisma.basket.findMany({
      where: { customerID },
      include: { product: true },
      orderBy: { productID: 'asc' },
    })
  }

  findItem(
    customerID: number,
    productID: number,
  ): Promise<BasketItemWithProduct | null> {
    return this.prisma.basket.findUnique({
      where: { customerID_productID: { customerID, productID } },
      include: { product: true },
    })
  }

  async addItemWithStock(
    customerID: number,
    productID: number,
    quantity: number,
  ): Promise<BasketAddItemResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const product = await transaction.product.findUnique({
              where: { productID },
            })
            if (!product) return { kind: 'product-not-found' }

            const existing = await transaction.basket.findUnique({
              where: { customerID_productID: { customerID, productID } },
            })
            const newQuantity = (existing?.quantity ?? 0) + quantity
            if (newQuantity > product.productStock) {
              return {
                kind: 'insufficient-stock',
                stock: product.productStock,
              }
            }

            const item = await transaction.basket.upsert({
              where: { customerID_productID: { customerID, productID } },
              create: { customerID, productID, quantity: newQuantity },
              update: { quantity: newQuantity },
              include: { product: true },
            })
            return { kind: 'added', item }
          },
          { isolationLevel: 'Serializable' },
        )
      } catch (error) {
        if (!isTransactionConflict(error) || attempt === 2) throw error
      }
    }
    throw new Error('Basket addition transaction retries exhausted')
  }

  upsertItem(
    customerID: number,
    productID: number,
    quantity: number,
  ): Promise<BasketItemWithProduct> {
    return this.prisma.basket.upsert({
      where: { customerID_productID: { customerID, productID } },
      create: { customerID, productID, quantity },
      update: { quantity },
      include: { product: true },
    })
  }

  async deleteItem(customerID: number, productID: number): Promise<void> {
    await this.prisma.basket.delete({
      where: { customerID_productID: { customerID, productID } },
    })
  }

  async deleteAllItems(customerID: number): Promise<void> {
    await this.prisma.basket.deleteMany({ where: { customerID } })
  }
}
