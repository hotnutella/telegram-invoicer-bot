import { db } from './connection';
import { User, Client, Product, Invoice, InvoiceLine, Payment } from '../types';

export class UserModel {
  static async create(user: User): Promise<void> {
    const query = `
      INSERT INTO users (telegram_id, company_name, reg_number, vat_number, address, city, zip_code, phone, email, bank_name, iban, swift)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    await db.execute(query, [
      user.telegram_id,
      user.company_name,
      user.reg_number,
      user.vat_number,
      user.address,
      user.city,
      user.zip_code,
      user.phone,
      user.email,
      user.bank_name,
      user.iban,
      user.swift
    ]);
  }

  static async findByTelegramId(telegramId: number): Promise<User | undefined> {
    const query = 'SELECT * FROM users WHERE telegram_id = $1';
    return await db.queryOne(query, [telegramId]);
  }

  static async update(telegramId: number, user: Partial<User>): Promise<void> {
    const fields = Object.keys(user).filter(key => key !== 'telegram_id');
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [telegramId, ...fields.map(field => (user as any)[field])];
    
    const query = `UPDATE users SET ${setClause} WHERE telegram_id = $1`;
    await db.execute(query, values);
  }

  static async delete(telegramId: number): Promise<void> {
    const query = 'DELETE FROM users WHERE telegram_id = $1';
    await db.execute(query, [telegramId]);
  }
}

export class ClientModel {
  static async create(client: Client): Promise<number> {
    const query = `
      INSERT INTO clients (user_id, name, address_line1, address_line2, country, reg_number, vat_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `;
    const result = await db.queryOne(query, [
      client.user_id,
      client.name,
      client.address_line1,
      client.address_line2,
      client.country,
      client.reg_number,
      client.vat_number
    ]);
    return result.id;
  }

  static async findById(id: number): Promise<Client | undefined> {
    const query = 'SELECT * FROM clients WHERE id = $1';
    return await db.queryOne(query, [id]);
  }

  static async findByUserId(userId: number): Promise<Client[]> {
    const query = 'SELECT * FROM clients WHERE user_id = $1 ORDER BY name';
    return await db.query(query, [userId]);
  }

  static async update(id: number, client: Partial<Client>): Promise<void> {
    const fields = Object.keys(client).filter(key => key !== 'id');
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => (client as any)[field])];
    
    const query = `UPDATE clients SET ${setClause} WHERE id = $1`;
    await db.execute(query, values);
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM clients WHERE id = $1';
    await db.execute(query, [id]);
  }
}

export class ProductModel {
  static async create(product: Product): Promise<number> {
    const query = `
      INSERT INTO products (user_id, name, description, default_price, default_vat_rate)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    const result = await db.queryOne(query, [
      product.user_id,
      product.name,
      product.description,
      product.default_price,
      product.default_vat_rate
    ]);
    return result.id;
  }

  static async findById(id: number): Promise<Product | undefined> {
    const query = 'SELECT * FROM products WHERE id = $1';
    return await db.queryOne(query, [id]);
  }

  static async findByUserId(userId: number): Promise<Product[]> {
    const query = 'SELECT * FROM products WHERE user_id = $1 ORDER BY name';
    return await db.query(query, [userId]);
  }

  static async update(id: number, product: Partial<Product>): Promise<void> {
    const fields = Object.keys(product).filter(key => key !== 'id');
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => (product as any)[field])];
    
    const query = `UPDATE products SET ${setClause} WHERE id = $1`;
    await db.execute(query, values);
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM products WHERE id = $1';
    await db.execute(query, [id]);
  }
}

export class InvoiceModel {
  static async create(invoice: Invoice): Promise<number> {
    const query = `
      INSERT INTO invoices (user_id, invoice_number, client_id, issue_date, due_date, subtotal, vat_total, total_amount, pdf_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `;
    const result = await db.queryOne(query, [
      invoice.user_id,
      invoice.invoice_number,
      invoice.client_id,
      invoice.issue_date,
      invoice.due_date,
      invoice.subtotal,
      invoice.vat_total,
      invoice.total_amount,
      invoice.pdf_path
    ]);
    return result.id;
  }

  static async findById(id: number): Promise<Invoice | undefined> {
    const query = 'SELECT * FROM invoices WHERE id = $1';
    return await db.queryOne(query, [id]);
  }

  static async findByUserId(userId: number): Promise<Invoice[]> {
    const query = 'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC';
    return await db.query(query, [userId]);
  }

  static async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | undefined> {
    const query = 'SELECT * FROM invoices WHERE invoice_number = $1';
    return await db.queryOne(query, [invoiceNumber]);
  }

  static async update(id: number, invoice: Partial<Invoice>): Promise<void> {
    const fields = Object.keys(invoice).filter(key => key !== 'id');
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => (invoice as any)[field])];
    
    const query = `UPDATE invoices SET ${setClause} WHERE id = $1`;
    await db.execute(query, values);
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM invoices WHERE id = $1';
    await db.execute(query, [id]);
  }

  static async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.queryOne(
      'SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE $1',
      [`${year}%`]
    );
    const count = (result?.count || 0) + 1;
    return `${year}${count.toString().padStart(3, '0')}`;
  }
}

export class InvoiceLineModel {
  static async create(line: InvoiceLine): Promise<number> {
    const query = `
      INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, vat_rate, line_total)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `;
    const result = await db.queryOne(query, [
      line.invoice_id,
      line.description,
      line.quantity,
      line.unit_price,
      line.vat_rate,
      line.line_total
    ]);
    return result.id;
  }

  static async findByInvoiceId(invoiceId: number): Promise<InvoiceLine[]> {
    const query = 'SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY id';
    return await db.query(query, [invoiceId]);
  }

  static async delete(id: number): Promise<void> {
    const query = 'DELETE FROM invoice_lines WHERE id = $1';
    await db.execute(query, [id]);
  }

  static async deleteByInvoiceId(invoiceId: number): Promise<void> {
    const query = 'DELETE FROM invoice_lines WHERE invoice_id = $1';
    await db.execute(query, [invoiceId]);
  }
}

export class PaymentModel {
  static async create(payment: Payment): Promise<number> {
    const query = `
      INSERT INTO payments (user_id, invoice_id, telegram_payment_charge_id, provider_payment_charge_id, amount, currency, payload, status, refunded)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `;
    const result = await db.queryOne(query, [
      payment.user_id,
      payment.invoice_id,
      payment.telegram_payment_charge_id,
      payment.provider_payment_charge_id,
      payment.amount,
      payment.currency,
      payment.payload,
      payment.status,
      payment.refunded
    ]);
    return result.id;
  }

  static async findById(id: number): Promise<Payment | undefined> {
    const query = 'SELECT * FROM payments WHERE id = $1';
    return await db.queryOne(query, [id]);
  }

  static async findByTelegramPaymentId(telegramPaymentId: string): Promise<Payment | undefined> {
    const query = 'SELECT * FROM payments WHERE telegram_payment_charge_id = $1';
    return await db.queryOne(query, [telegramPaymentId]);
  }

  static async findByUserId(userId: number): Promise<Payment[]> {
    const query = 'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC';
    return await db.query(query, [userId]);
  }

  static async markAsRefunded(id: number): Promise<void> {
    const query = 'UPDATE payments SET refunded = TRUE, refund_date = CURRENT_TIMESTAMP WHERE id = $1';
    await db.execute(query, [id]);
  }

  static async findByInvoiceId(invoiceId: number): Promise<Payment[]> {
    const query = 'SELECT * FROM payments WHERE invoice_id = $1';
    return await db.query(query, [invoiceId]);
  }
}