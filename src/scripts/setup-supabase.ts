import { supabaseAdmin } from '../database/supabase';
import fs from 'fs';
import path from 'path';

async function setupSupabase() {
  console.log('🚀 Setting up Supabase database and storage...');

  try {
    // Test connection
    console.log('🔍 Testing Supabase connection...');
    const { data, error } = await supabaseAdmin.from('users').select('*').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "table not found" which is expected
      throw error;
    }
    console.log('✅ Supabase connection successful');

    // Create database schema by checking/creating tables
    console.log('📋 Setting up database schema...');
    
    // Check if tables exist by trying to select from them
    const tables = ['users', 'clients', 'products', 'invoices', 'invoice_lines', 'payments'];
    
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).select('*').limit(1);
      if (error && error.code === 'PGRST116') {
        console.log(`⚠️  Table '${table}' doesn't exist. Please create it manually in Supabase dashboard.`);
      } else if (error) {
        console.log(`⚠️  Error checking table '${table}':`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }
    
    console.log('📋 Schema check complete. If tables don\'t exist, please run the SQL schema in Supabase dashboard.');
    console.log('📄 Schema file location: src/database/schema.sql');

    // Check if storage bucket exists
    console.log('🪣 Checking storage bucket...');
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'invoice-pdfs';
    
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      throw listError;
    }

    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      console.log('🆕 Creating storage bucket...');
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

    // Get database connection info
    console.log('🔗 Getting database connection info...');
    const supabaseUrl = process.env.SUPABASE_URL!;
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];
    
    console.log('📝 Database setup complete!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. If tables don\'t exist, go to Supabase dashboard > SQL Editor');
    console.log('2. Run the SQL schema from: src/database/schema.sql');
    console.log('3. Get your database password from Supabase dashboard > Settings > Database');
    console.log('4. Add the DATABASE_URL to your .env file:');
    console.log(`   DATABASE_URL=postgresql://postgres:[your_password]@db.${projectRef}.supabase.co:5432/postgres`);
    console.log('5. Run: npm run migrate (if you have existing data)');
    console.log('6. Test the bot: npm run dev');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupSupabase().catch(console.error);