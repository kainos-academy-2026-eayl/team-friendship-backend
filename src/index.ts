import 'dotenv/config';
import dotenv from 'dotenv';
import { createApp } from './app';
import { AuthController } from './controllers/authController';
import { BasketController } from './controllers/basketController';
import { LoginController } from './controllers/loginController';
import { OrderHistoryController } from './controllers/orderHistoryController';
import { ProductController } from './controllers/productController';
import { createPrismaClient } from './db/prisma';
import { BasketRepository } from './repositories/basketRepository';
import { LoginRepository } from './repositories/loginRepository';
import { OrderHistoryRepository } from './repositories/orderHistoryRepository';
import { ProductRepository } from './repositories/productRepository';
import { RefreshTokenRepository } from './repositories/refreshTokenRepository';
import { AccessTokenService } from './services/accessTokenService';
import { AuthService } from './services/authService';
import { BasketService } from './services/basketService';
import { LoginService } from './services/loginService';
import { OrderHistoryService } from './services/orderHistoryService';
import { ProductService } from './services/productService';

if (!process.env.PORT) {
  throw new Error('PORT environment variable is not set');
}

const HOST = process.env.HOST ?? 'localhost';
const PORT = Number(process.env.PORT);

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET environment variable is not set');
}

const app = createApp();
const prisma = createPrismaClient();
const accessTokens = new AccessTokenService(process.env.JWT_ACCESS_SECRET);

// Register new controllers / middleware here!

// app.use('/', ...)
// Everything here is public and does not require authentication
const loginController = new LoginController(
  new LoginService(new LoginRepository(prisma)),
  new AuthService(accessTokens, new RefreshTokenRepository(prisma)),
);
app.use('/', loginController.router());

const authController = new AuthController(accessTokens);
app.use('/', authController.router());

const productController = new ProductController(
  new ProductService(new ProductRepository(prisma)),
);
app.use('/', productController.router());

const basketController = new BasketController(
  new BasketService(new BasketRepository(prisma)),
);
app.use('/', basketController.router());

// Everything below this comment requires authentication
app.use(authController.requireAuth);

//Order history, order confirmation and checkout will require auth
const orderHistoryController = new OrderHistoryController(
  new OrderHistoryService(new OrderHistoryRepository(prisma)),
);
app.use('/', orderHistoryController.router());

// Keep everything below this comment at the bottom of the file
const server = app.listen(PORT, HOST, () => {
  console.log(`Listening on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

//using the sendEmail function to send an email

dotenv.config();
