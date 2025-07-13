// Database connection
export { db, default as connection } from './connection';

// Database models
export {
  UserModel,
  ClientModel,
  ProductModel,
  InvoiceModel,
  InvoiceLineModel,
  PaymentModel
} from './models';

// Supabase client (for storage)
export { supabase } from './supabase';