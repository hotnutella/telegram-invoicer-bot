export interface User {
  telegram_id: number;
  company_name?: string;
  reg_number?: string;
  vat_number?: string;
  address?: string;
  city?: string;
  zip_code?: string;
  phone?: string;
  email?: string;
  bank_name?: string;
  iban?: string;
  swift?: string;
  created_at?: string;
}

export interface Client {
  id?: number;
  user_id: number;
  name: string;
  address_line1?: string;
  address_line2?: string;
  country?: string;
  reg_number?: string;
  vat_number?: string;
  created_at?: string;
}

export interface Product {
  id?: number;
  user_id: number;
  name: string;
  description?: string;
  default_price?: number;
  default_vat_rate?: number;
  created_at?: string;
}

export interface Invoice {
  id?: number;
  user_id: number;
  invoice_number: string;
  client_id: number;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat_total: number;
  total_amount: number;
  pdf_path?: string;
  created_at?: string;
}

export interface InvoiceLine {
  id?: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
}

export interface ConversationState {
  step: string;
  data: any;
  temp_invoice_id?: string;
}

export interface InvoiceCreationState {
  client_id?: number;
  lines: InvoiceLine[];
  current_line?: Partial<InvoiceLine>;
}

export interface VATBreakdown {
  rate: number;
  amount: number;
  vat_amount: number;
}