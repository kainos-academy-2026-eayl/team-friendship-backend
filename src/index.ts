import 'dotenv/config';
import dotenv from 'dotenv';
import { createApp } from './app';
import { LoginController } from './controllers/loginController';
import { createPrismaClient } from './db/prisma';
import { LoginRepository } from './repositories/loginRepository';
import { sendEmail } from './services/emailService';
import { LoginService } from './services/loginService';

if (!process.env.PORT) {
  throw new Error('PORT environment variable is not set');
}

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT);

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

const app = createApp();
const prisma = createPrismaClient();

// Register new controllers / middleware here!

// app.use('/', ...)
const loginController = new LoginController(
  new LoginService(new LoginRepository(prisma)),
);
app.use('/', loginController.router());

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

sendEmail({
  subject: 'Hello from TypeScript',
  text: 'Hello world!',
});
