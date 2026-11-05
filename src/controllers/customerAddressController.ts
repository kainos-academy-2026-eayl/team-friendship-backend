import { type Request, type Response, Router } from 'express';
import type { CustomerAddressRepository } from '../repositories/customerAddressRepository';

type AddressLookup = Pick<CustomerAddressRepository, 'findByCustomerId'>;

export class CustomerAddressController {
  constructor(private readonly addresses: AddressLookup) {}

  getOwnAddress = async (_req: Request, res: Response): Promise<void> => {
    const principal = res.locals.principal;
    if (!principal) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (principal.type !== 'customer') {
      res.status(403).json({ error: 'Only customers have a saved address' });
      return;
    }

    try {
      const address = await this.addresses.findByCustomerId(principal.id);
      if (!address) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      res.status(200).json({ address });
    } catch (error) {
      console.error('Unable to load customer address', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  router(): Router {
    const router = Router();

    router.get('/customers/me/address', this.getOwnAddress);

    return router;
  }
}
