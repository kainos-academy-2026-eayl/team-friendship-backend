import express, {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { BasketError, type BasketService } from '../services/basketService'

type BasketServiceContract = Pick<
  BasketService,
  'getBasket' | 'addItem' | 'updateItemQuantity' | 'removeItem' | 'clearBasket'
>

function parseId(value: unknown, field: string): number {
  const id = Number(value)
  if (typeof value !== 'string' || !Number.isInteger(id) || id <= 0) {
    throw new BasketError(`${field} must be a positive integer`, 400)
  }
  return id
}

function parseQuantity(body: unknown): number {
  const quantity = (body as { quantity?: unknown } | undefined)?.quantity
  if (typeof quantity !== 'number') {
    throw new BasketError('quantity must be a positive integer', 400)
  }
  return quantity
}

function parseProductId(body: unknown): number {
  const productID = (body as { productID?: unknown } | undefined)?.productID
  if (
    typeof productID !== 'number' ||
    !Number.isInteger(productID) ||
    productID <= 0
  ) {
    throw new BasketError('productID must be a positive integer', 400)
  }
  return productID
}

export class BasketController {
  constructor(private readonly service: BasketServiceContract) {}

  getBasket = async (req: Request, res: Response): Promise<void> => {
    const customerID = parseId(req.params.customerId, 'customerId')
    res.json(await this.service.getBasket(customerID))
  }

  addItem = async (req: Request, res: Response): Promise<void> => {
    const customerID = parseId(req.params.customerId, 'customerId')
    const item = await this.service.addItem(
      customerID,
      parseProductId(req.body),
      parseQuantity(req.body),
    )
    res.status(201).json(item)
  }

  updateItem = async (req: Request, res: Response): Promise<void> => {
    const customerID = parseId(req.params.customerId, 'customerId')
    const productID = parseId(req.params.productId, 'productId')
    res.json(
      await this.service.updateItemQuantity(
        customerID,
        productID,
        parseQuantity(req.body),
      ),
    )
  }

  removeItem = async (req: Request, res: Response): Promise<void> => {
    const customerID = parseId(req.params.customerId, 'customerId')
    const productID = parseId(req.params.productId, 'productId')
    await this.service.removeItem(customerID, productID)
    res.status(204).end()
  }

  clearBasket = async (req: Request, res: Response): Promise<void> => {
    const customerID = parseId(req.params.customerId, 'customerId')
    await this.service.clearBasket(customerID)
    res.status(204).end()
  }

  router(): Router {
    const router = Router()
    router.use(express.json())

    router.get('/customers/:customerId/basket', this.getBasket)
    router.delete('/customers/:customerId/basket', this.clearBasket)
    router.post('/customers/:customerId/basket/items', this.addItem)
    router.patch(
      '/customers/:customerId/basket/items/:productId',
      this.updateItem,
    )
    router.delete(
      '/customers/:customerId/basket/items/:productId',
      this.removeItem,
    )

    // Express 5 forwards rejected promises from async handlers to this error handler.
    router.use(
      (error: unknown, _req: Request, res: Response, next: NextFunction) => {
        if (error instanceof BasketError) {
          res.status(error.statusCode).json({ error: error.message })
          return
        }
        next(error)
      },
    )

    return router
  }
}
