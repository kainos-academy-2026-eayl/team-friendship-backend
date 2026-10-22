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

let prismaClient: PrismaClient | undefined

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
