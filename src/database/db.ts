import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './database/invoices.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: Database.Database = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    company_name TEXT,
    reg_number TEXT,
    vat_number TEXT,
    address TEXT,
    city TEXT,
    zip_code TEXT,
    phone TEXT,
    email TEXT,
    bank_name TEXT,
    iban TEXT,
    swift TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    country TEXT,
    reg_number TEXT,
    vat_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    default_price DECIMAL(10,2),
    default_vat_rate INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    invoice_number TEXT UNIQUE,
    client_id INTEGER,
    issue_date DATE,
    due_date DATE,
    subtotal DECIMAL(10,2),
    vat_total DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    pdf_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id),
    FOREIGN KEY (client_id) REFERENCES clients (id)
  );

  CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2),
    unit_price DECIMAL(10,2),
    vat_rate INTEGER,
    line_total DECIMAL(10,2),
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    invoice_id INTEGER,
    telegram_payment_charge_id TEXT,
    provider_payment_charge_id TEXT,
    amount INTEGER,
    currency TEXT,
    payload TEXT,
    status TEXT DEFAULT 'completed',
    refunded BOOLEAN DEFAULT FALSE,
    refund_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id),
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
  );

  -- Add missing columns to existing payments table if they don't exist
  PRAGMA table_info(payments);
`)

// Check if the payments table exists and has the old structure, then migrate
try {
  const tableInfo = db.prepare("PRAGMA table_info(payments)").all() as any[];
  const hasNewColumns = tableInfo.some(col => col.name === 'telegram_payment_charge_id');
  
  if (tableInfo.length > 0 && !hasNewColumns) {
    console.log('Migrating payments table to new structure...');
    
    // Backup existing data
    const existingPayments = db.prepare("SELECT * FROM payments").all();
    
    // Drop old table and recreate with new structure
    db.exec('DROP TABLE payments');
    
    db.exec(`
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        invoice_id INTEGER,
        telegram_payment_charge_id TEXT,
        provider_payment_charge_id TEXT,
        amount INTEGER,
        currency TEXT,
        payload TEXT,
        status TEXT DEFAULT 'completed',
        refunded BOOLEAN DEFAULT FALSE,
        refund_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (telegram_id),
        FOREIGN KEY (invoice_id) REFERENCES invoices (id)
      )
    `);
    
    // Migrate existing data if any
    if (existingPayments.length > 0) {
      const migrateStmt = db.prepare(`
        INSERT INTO payments (user_id, invoice_id, telegram_payment_charge_id, amount, currency, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (const payment of existingPayments) {
        const p = payment as any;
        migrateStmt.run(
          p.user_id,
          p.invoice_id,
          p.payment_id || 'migrated', // Use old payment_id or default
          p.amount,
          p.currency || 'XTR',
          p.created_at
        );
      }
    }
    
    console.log('Payments table migration completed.');
  }
} catch (error) {
  console.error('Migration error:', error);
}

db.exec(`
`);

export default db;