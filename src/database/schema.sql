-- Telegram Invoice Bot Database Schema for PostgreSQL

-- Users table
CREATE TABLE IF NOT EXISTS users (
    telegram_id BIGINT PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    user_id BIGINT,
    name TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    country TEXT,
    reg_number TEXT,
    vat_number TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    user_id BIGINT,
    name TEXT NOT NULL,
    description TEXT,
    default_price DECIMAL(10,2),
    default_vat_rate INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id BIGINT,
    invoice_number TEXT UNIQUE,
    client_id INTEGER,
    issue_date DATE,
    due_date DATE,
    subtotal DECIMAL(10,2),
    vat_total DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    pdf_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id),
    FOREIGN KEY (client_id) REFERENCES clients (id)
);

-- Invoice lines table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2),
    unit_price DECIMAL(10,2),
    vat_rate INTEGER,
    line_total DECIMAL(10,2),
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id BIGINT,
    invoice_id INTEGER,
    telegram_payment_charge_id TEXT,
    provider_payment_charge_id TEXT,
    amount INTEGER,
    currency TEXT,
    payload TEXT,
    status TEXT DEFAULT 'completed',
    refunded BOOLEAN DEFAULT FALSE,
    refund_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (telegram_id),
    FOREIGN KEY (invoice_id) REFERENCES invoices (id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_telegram_charge_id ON payments(telegram_payment_charge_id);