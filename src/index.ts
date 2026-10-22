import 'dotenv/config'
import { createApp } from './app'
import { BasketController } from './controllers/basketController'
import { BasketRepository } from './repositories/basketRepository'
import { BasketService } from './services/basketService'

if (!process.env.PORT) {
  throw new Error('PORT environment variable is not set')
}

const HOST = '0.0.0.0'
const PORT = Number(process.env.PORT)

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`)
}

const app = createApp()
const basketRepository = new BasketRepository()
const basketService = new BasketService(basketRepository)
const basketController = new BasketController(basketService)
app.use('/', basketController.router())

// Keep everything below this comment at the bottom of the file
const server = app.listen(PORT, HOST, () => {
  console.log(`Listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
