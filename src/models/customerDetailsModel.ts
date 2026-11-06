import { z } from 'zod';

export const customerDetailsUpdateSchema = z.object({
  customerForename: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(100),
  customerSurname: z.string().trim().min(1, 'Surname is required.').max(100),
  customerEmail: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email('Enter a valid email address.')),
  customerPhone: z.string().trim().min(1, 'Phone number is required.').max(50),
  address: z.string().trim().min(1, 'Address is required.').max(500),
  postcode: z.string().trim().min(1, 'Postcode is required.').max(20),
  password: z.string().min(1, 'Enter your current password to save.').max(128),
});

export type CustomerDetailsUpdate = Omit<
  z.infer<typeof customerDetailsUpdateSchema>,
  'password'
>;
