export interface CustomerRecord {
  customerID: number;
  customerForename: string;
  customerSurname: string;
  address: string;
  postcode: string;
  customerEmail: string;
  customerPhone: string;
  customerPassword: string;
}

export type NewCustomer = Omit<CustomerRecord, 'customerID'>;

export interface CustomerRepository {
  create(customer: NewCustomer): Promise<CustomerRecord>;
}

export class DuplicateCustomerEmailError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'DuplicateCustomerEmailError';
  }
}
