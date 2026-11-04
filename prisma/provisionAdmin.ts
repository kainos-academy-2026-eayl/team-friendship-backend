import 'dotenv/config';
import argon2 from 'argon2';
import { createPrismaClient } from '../src/db/prisma';

const email = (process.env.ADMIN_EMAIL ?? 'admin@friendshop.com')
  .trim()
  .toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!password || password.length > 128) {
  throw new Error(
    'Set ADMIN_PASSWORD to a non-empty password of at most 128 characters before provisioning.',
  );
}

if (email !== 'admin@friendshop.com') {
  throw new Error('ADMIN_EMAIL must be admin@friendshop.com.');
}

const prisma = createPrismaClient();

try {
  const staffPassword = await argon2.hash(password);
  await prisma.staff.upsert({
    where: { staffEmail: email },
    create: {
      staffForename: 'Friendshop',
      staffSurname: 'Administrator',
      staffRole: 'ADMIN',
      staffavailability: 'AVAILABLE',
      staffEmail: email,
      staffPassword,
    },
    update: { staffPassword, staffRole: 'ADMIN' },
  });
  console.log(`Administrator staff account provisioned for ${email}.`);
} finally {
  await prisma.$disconnect();
}
