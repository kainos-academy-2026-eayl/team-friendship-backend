import 'dotenv/config';
import { createPrismaClient } from '../src/db/prisma';

// Dev-only: replaces one customer's basket with sample in-stock products so checkout can be tested
// without reseeding (which would delete accounts registered through the app).
const email = process.argv[2]?.trim();
if (!email) {
  throw new Error('Usage: npm run basket:fill -- <customer email>');
}

const prisma = createPrismaClient();

try {
  const customer = await prisma.customer.findFirst({
    where: { customerEmail: { equals: email, mode: 'insensitive' } },
    select: { customerID: true, customerEmail: true },
  });
  if (!customer) {
    throw new Error(`No customer found with email ${email}.`);
  }

  const products = await prisma.product.findMany({
    where: { productStock: { gte: 2 } },
    orderBy: { productID: 'asc' },
    take: 3,
    select: { productID: true, productName: true },
  });
  const items = products.map((product, index) => ({
    customerID: customer.customerID,
    productID: product.productID,
    quantity: index === 0 ? 2 : 1,
  }));

  await prisma.$transaction([
    prisma.basket.deleteMany({ where: { customerID: customer.customerID } }),
    prisma.basket.createMany({ data: items }),
  ]);

  console.log(`Basket for ${customer.customerEmail} now contains:`);
  for (const [index, product] of products.entries()) {
    console.log(`  ${items[index]?.quantity} x ${product.productName}`);
  }
} finally {
  await prisma.$disconnect();
}
