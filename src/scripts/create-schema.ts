import { supabaseAdmin } from '../database/supabase';

async function createSchema() {
  console.log('🚀 Creating database schema in Supabase...');

  try {
    // Create tables using raw SQL through supabaseAdmin
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
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
      )`,
      
      `CREATE TABLE IF NOT EXISTS clients (
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
      )`,
      
      `CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        name TEXT NOT NULL,
        description TEXT,
        default_price DECIMAL(10,2),
        default_vat_rate INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (telegram_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS invoices (
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
      )`,
      
      `CREATE TABLE IF NOT EXISTS invoice_lines (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER,
        description TEXT NOT NULL,
        quantity DECIMAL(10,2),
        unit_price DECIMAL(10,2),
        vat_rate INTEGER,
        line_total DECIMAL(10,2),
        FOREIGN KEY (invoice_id) REFERENCES invoices (id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS payments (
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
      )`
    ];

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)',
      'CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_telegram_charge_id ON payments(telegram_payment_charge_id)'
    ];

    console.log('📋 Creating tables...');
    
    for (const query of queries) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: query });
        if (error) {
          console.log(`⚠️  Query failed, trying alternative approach: ${error.message}`);
          // If RPC fails, we'll need to create these manually
        } else {
          console.log('✅ Table created successfully');
        }
      } catch (err) {
        console.log(`⚠️  Table creation failed: ${err}`);
      }
    }

    console.log('🔍 Creating indexes...');
    for (const index of indexes) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: index });
        if (error) {
          console.log(`⚠️  Index creation failed: ${error.message}`);
        } else {
          console.log('✅ Index created successfully');
        }
      } catch (err) {
        console.log(`⚠️  Index creation failed: ${err}`);
      }
    }

    console.log('🪣 Creating storage bucket...');
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'invoice-pdfs';
    
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      throw listError;
    }

    const bucketExists = buckets.some((bucket: any) => bucket.name === bucketName);
    
    if (!bucketExists) {
      const { error: bucketError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['application/pdf'],
        fileSizeLimit: 10485760 // 10MB
      });
      
      if (bucketError) {
        throw bucketError;
      }
      console.log('✅ Storage bucket created successfully');
    } else {
      console.log('✅ Storage bucket already exists');
    }

    console.log('');
    console.log('✅ Schema setup complete!');
    console.log('');
    console.log('📋 If table creation failed above, please manually run this SQL in Supabase dashboard:');
    console.log('   Go to: Supabase Dashboard > SQL Editor > New Query');
    console.log('   Copy and paste the content from: src/database/schema.sql');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Get your database password from Supabase dashboard > Settings > Database');
    console.log('2. Add the DATABASE_URL to your .env file');
    console.log('3. Run: npm run migrate (if you have existing data)');
    console.log('4. Test the bot: npm run dev');

  } catch (error) {
    console.error('❌ Schema creation failed:', error);
    
    console.log('');
    console.log('📋 Manual setup required:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Create a new query and paste the content from: src/database/schema.sql');
    console.log('3. Run the query to create all tables');
    console.log('4. Continue with the setup steps above');
  }
}

createSchema().catch(console.error);