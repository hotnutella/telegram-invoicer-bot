import { db } from './connection';
import { User, Client, Product, Invoice, InvoiceLine, Payment } from '../types';

export class UserModel {
  static async create(user: User): Promise<void> {
    await db.client.insert('users', {
      telegram_id: user.telegram_id,
      company_name: user.company_name,
      reg_number: user.reg_number,
      vat_number: user.vat_number,
      address: user.address,
      city: user.city,
      zip_code: user.zip_code,
      phone: user.phone,
      email: user.email,
      bank_name: user.bank_name,
      iban: user.iban,
      swift: user.swift
    });
  }

  static async findByTelegramId(telegramId: number): Promise<User | undefined> {
    return await db.client.queryOne('users', {
      eq: { telegram_id: telegramId }
    });
  }

  static async update(telegramId: number, user: Partial<User>): Promise<void> {
    const updateData = { ...user };
    delete updateData.telegram_id; // Remove telegram_id from update data
    
    await db.client.update('users', updateData, { telegram_id: telegramId });
  }

  static async delete(telegramId: number): Promise<void> {
    await db.client.delete('users', { telegram_id: telegramId });
  }
}

export class ClientModel {
  static async create(client: Client): Promise<number> {
    const result = await db.client.insert('clients', {
      user_id: client.user_id,
      name: client.name,
      address_line1: client.address_line1,
      address_line2: client.address_line2,
      country: client.country,
      reg_number: client.reg_number,
      vat_number: client.vat_number
    });
    return result.id;
  }

  static async findById(id: number): Promise<Client | undefined> {
    return await db.client.queryOne('clients', {
      eq: { id }
    });
  }

  static async findByUserId(userId: number): Promise<Client[]> {
    return await db.client.query('clients', {
      eq: { user_id: userId },
      order: 'name'
    });
  }

  static async update(id: number, client: Partial<Client>): Promise<void> {
    const updateData = { ...client };
    delete updateData.id; // Remove id from update data
    
    await db.client.update('clients', updateData, { id });
  }

  static async delete(id: number): Promise<void> {
    await db.client.delete('clients', { id });
  }
}

export class ProductModel {
  static async create(product: Product): Promise<number> {
    const result = await db.client.insert('products', {
      user_id: product.user_id,
      name: product.name,
      description: product.description,
      default_price: product.default_price,
      default_vat_rate: product.default_vat_rate
    });
    return result.id;
  }

  static async findById(id: number): Promise<Product | undefined> {
    return await db.client.queryOne('products', {
      eq: { id }
    });
  }

  static async findByUserId(userId: number): Promise<Product[]> {
    return await db.client.query('products', {
      eq: { user_id: userId },
      order: 'name'
    });
  }

  static async update(id: number, product: Partial<Product>): Promise<void> {
    const updateData = { ...product };
    delete updateData.id; // Remove id from update data
    
    await db.client.update('products', updateData, { id });
  }

  static async delete(id: number): Promise<void> {
    await db.client.delete('products', { id });
  }
}

export class InvoiceModel {
  static async create(invoice: Invoice): Promise<number> {
    const result = await db.client.insert('invoices', {
      user_id: invoice.user_id,
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      subtotal: invoice.subtotal,
      vat_total: invoice.vat_total,
      total_amount: invoice.total_amount,
      pdf_path: invoice.pdf_path
    });
    return result.id;
  }

  static async findById(id: number): Promise<Invoice | undefined> {
    return await db.client.queryOne('invoices', {
      eq: { id }
    });
  }

  static async findByUserId(userId: number): Promise<Invoice[]> {
    return await db.client.query('invoices', {
      eq: { user_id: userId },
      order: 'created_at.desc'
    });
  }

  static async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    return await db.client.queryOne('invoices', {
      eq: { invoice_number: invoiceNumber }
    });
  }

  static async update(id: number, invoice: Partial<Invoice>): Promise<void> {
    const updateData = { ...invoice };
    delete updateData.id; // Remove id from update data
    
    await db.client.update('invoices', updateData, { id });
  }

  static async delete(id: number): Promise<void> {
    await db.client.delete('invoices', { id });
  }

  static async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Get count of invoices that start with the current year
    const invoices = await db.client.query('invoices', {
      select: 'invoice_number',
      // Note: For complex filtering like LIKE, we might need a custom approach
      // For now, we'll get all invoices and filter in code
    });
    
    const yearInvoices = invoices.filter(inv => inv.invoice_number.startsWith(year.toString()));
    const count = yearInvoices.length + 1;
    
    return `${year}${count.toString().padStart(3, '0')}`;
  }
}

export class InvoiceLineModel {
  static async create(line: InvoiceLine): Promise<number> {
    const result = await db.client.insert('invoice_lines', {
      invoice_id: line.invoice_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      vat_rate: line.vat_rate,
      line_total: line.line_total
    });
    return result.id;
  }

  static async findByInvoiceId(invoiceId: number): Promise<InvoiceLine[]> {
    return await db.client.query('invoice_lines', {
      eq: { invoice_id: invoiceId },
      order: 'id'
    });
  }

  static async delete(id: number): Promise<void> {
    await db.client.delete('invoice_lines', { id });
  }

  static async deleteByInvoiceId(invoiceId: number): Promise<void> {
    await db.client.delete('invoice_lines', { invoice_id: invoiceId });
  }
}

export class PaymentModel {
  static async create(payment: Payment): Promise<number> {
    const result = await db.client.insert('payments', {
      user_id: payment.user_id,
      invoice_id: payment.invoice_id,
      telegram_payment_charge_id: payment.telegram_payment_charge_id,
      provider_payment_charge_id: payment.provider_payment_charge_id,
      amount: payment.amount,
      currency: payment.currency,
      payload: payment.payload,
      status: payment.status,
      refunded: payment.refunded
    });
    return result.id;
  }

  static async findById(id: number): Promise<Payment | undefined> {
    return await db.client.queryOne('payments', {
      eq: { id }
    });
  }

  static async findByTelegramPaymentId(telegramPaymentId: string): Promise<Payment | undefined> {
    return await db.client.queryOne('payments', {
      eq: { telegram_payment_charge_id: telegramPaymentId }
    });
  }

  static async findByUserId(userId: number): Promise<Payment[]> {
    return await db.client.query('payments', {
      eq: { user_id: userId },
      order: 'created_at.desc'
    });
  }

  static async markAsRefunded(id: number): Promise<void> {
    await db.client.update('payments', {
      refunded: true,
      refund_date: new Date().toISOString()
    }, { id });
  }

  static async findByInvoiceId(invoiceId: number): Promise<Payment[]> {
    return await db.client.query('payments', {
      eq: { invoice_id: invoiceId }
    });
  }
}