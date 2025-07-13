import { User, Client, Product, Invoice, InvoiceLine, Payment } from '../types';

declare module './models' {
  export class UserModel {
    static create(user: User): Promise<void>;
    static findByTelegramId(telegramId: number): Promise<User | undefined>;
    static update(telegramId: number, user: Partial<User>): Promise<void>;
    static delete(telegramId: number): Promise<void>;
  }

  export class ClientModel {
    static create(client: Client): Promise<number>;
    static findById(id: number): Promise<Client | undefined>;
    static findByUserId(userId: number): Promise<Client[]>;
    static update(id: number, client: Partial<Client>): Promise<void>;
    static delete(id: number): Promise<void>;
  }

  export class ProductModel {
    static create(product: Product): Promise<number>;
    static findById(id: number): Promise<Product | undefined>;
    static findByUserId(userId: number): Promise<Product[]>;
    static update(id: number, product: Partial<Product>): Promise<void>;
    static delete(id: number): Promise<void>;
  }

  export class InvoiceModel {
    static create(invoice: Invoice): Promise<number>;
    static findById(id: number): Promise<Invoice | undefined>;
    static findByUserId(userId: number): Promise<Invoice[]>;
    static findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | undefined>;
    static update(id: number, invoice: Partial<Invoice>): Promise<void>;
    static delete(id: number): Promise<void>;
    static generateInvoiceNumber(): Promise<string>;
  }

  export class InvoiceLineModel {
    static create(line: InvoiceLine): Promise<number>;
    static findByInvoiceId(invoiceId: number): Promise<InvoiceLine[]>;
    static delete(id: number): Promise<void>;
    static deleteByInvoiceId(invoiceId: number): Promise<void>;
  }

  export class PaymentModel {
    static create(payment: Payment): Promise<number>;
    static findById(id: number): Promise<Payment | undefined>;
    static findByTelegramPaymentId(telegramPaymentId: string): Promise<Payment | undefined>;
    static findByUserId(userId: number): Promise<Payment[]>;
    static markAsRefunded(id: number): Promise<void>;
    static findByInvoiceId(invoiceId: number): Promise<Payment[]>;
  }
}