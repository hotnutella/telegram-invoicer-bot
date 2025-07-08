import Database from 'better-sqlite3';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const SQLITE_DB_PATH = process.env.DATABASE_PATH || './database/invoices.db';
const POSTGRES_URL = process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Check if SQLite database exists
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.log('No SQLite database found. Starting fresh with PostgreSQL.');
  process.exit(0);
}

async function migrateData() {
  console.log('🚀 Starting migration from SQLite to PostgreSQL...');

  // Connect to SQLite
  const sqliteDb = new Database(SQLITE_DB_PATH);
  
  // Connect to PostgreSQL
  const pgPool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Create tables in PostgreSQL
    console.log('📋 Creating PostgreSQL tables...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pgPool.query(schemaSql);

    // Migrate users
    console.log('👥 Migrating users...');
    const users = sqliteDb.prepare('SELECT * FROM users').all() as any[];
    for (const user of users) {
      await pgPool.query(`
        INSERT INTO users (telegram_id, company_name, reg_number, vat_number, address, city, zip_code, phone, email, bank_name, iban, swift, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (telegram_id) DO NOTHING
      `, [
        user.telegram_id, user.company_name, user.reg_number, user.vat_number,
        user.address, user.city, user.zip_code, user.phone, user.email,
        user.bank_name, user.iban, user.swift, user.created_at
      ]);
    }

    // Migrate clients
    console.log('🏢 Migrating clients...');
    const clients = sqliteDb.prepare('SELECT * FROM clients').all() as any[];
    for (const client of clients) {
      await pgPool.query(`
        INSERT INTO clients (id, user_id, name, address_line1, address_line2, country, reg_number, vat_number, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        client.id, client.user_id, client.name, client.address_line1, client.address_line2,
        client.country, client.reg_number, client.vat_number, client.created_at
      ]);
    }

    // Migrate products
    console.log('📦 Migrating products...');
    const products = sqliteDb.prepare('SELECT * FROM products').all() as any[];
    for (const product of products) {
      await pgPool.query(`
        INSERT INTO products (id, user_id, name, description, default_price, default_vat_rate, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        product.id, product.user_id, product.name, product.description,
        product.default_price, product.default_vat_rate, product.created_at
      ]);
    }

    // Migrate invoices
    console.log('📄 Migrating invoices...');
    const invoices = sqliteDb.prepare('SELECT * FROM invoices').all() as any[];
    for (const invoice of invoices) {
      await pgPool.query(`
        INSERT INTO invoices (id, user_id, invoice_number, client_id, issue_date, due_date, subtotal, vat_total, total_amount, pdf_path, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `, [
        invoice.id, invoice.user_id, invoice.invoice_number, invoice.client_id,
        invoice.issue_date, invoice.due_date, invoice.subtotal, invoice.vat_total,
        invoice.total_amount, invoice.pdf_path, invoice.created_at
      ]);
    }

    // Migrate invoice lines
    console.log('📋 Migrating invoice lines...');
    const invoiceLines = sqliteDb.prepare('SELECT * FROM invoice_lines').all() as any[];
    for (const line of invoiceLines) {
      await pgPool.query(`
        INSERT INTO invoice_lines (id, invoice_id, description, quantity, unit_price, vat_rate, line_total)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
      `, [
        line.id, line.invoice_id, line.description, line.quantity,
        line.unit_price, line.vat_rate, line.line_total
      ]);
    }

    // Migrate payments (if table exists)
    console.log('💰 Migrating payments...');
    try {
      const payments = sqliteDb.prepare('SELECT * FROM payments').all() as any[];
      for (const payment of payments) {
        await pgPool.query(`
          INSERT INTO payments (id, user_id, invoice_id, telegram_payment_charge_id, provider_payment_charge_id, amount, currency, payload, status, refunded, refund_date, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [
          payment.id, payment.user_id, payment.invoice_id, payment.telegram_payment_charge_id,
          payment.provider_payment_charge_id, payment.amount, payment.currency, payment.payload,
          payment.status, payment.refunded, payment.refund_date, payment.created_at
        ]);
      }
    } catch (error) {
      console.log('⚠️  No payments table found in SQLite, skipping payments migration');
    }

    // Update sequences for PostgreSQL
    console.log('🔄 Updating PostgreSQL sequences...');
    await pgPool.query(`
      SELECT setval('clients_id_seq', (SELECT COALESCE(MAX(id), 1) FROM clients));
      SELECT setval('products_id_seq', (SELECT COALESCE(MAX(id), 1) FROM products));
      SELECT setval('invoices_id_seq', (SELECT COALESCE(MAX(id), 1) FROM invoices));
      SELECT setval('invoice_lines_id_seq', (SELECT COALESCE(MAX(id), 1) FROM invoice_lines));
      SELECT setval('payments_id_seq', (SELECT COALESCE(MAX(id), 1) FROM payments));
    `);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Migration summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Clients: ${clients.length}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Invoices: ${invoices.length}`);
    console.log(`   Invoice Lines: ${invoiceLines.length}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

// Run migration
migrateData().catch(console.error);