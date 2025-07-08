import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Extract connection details from Supabase URL
const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
  process.exit(1);
}

async function createDatabaseSchema() {
  console.log('🚀 Creating database schema via Supabase client...');
  
  // Create admin client with service key
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Read and execute schema
    console.log('📋 Reading schema file...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Split into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    // Execute each statement individually
    for (const [index, statement] of statements.entries()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Table already exists (${index + 1}/${statements.length})`);
          } else {
            console.error(`❌ Error in statement ${index + 1}:`, error.message);
          }
        } else {
          console.log(`✅ Statement ${index + 1}/${statements.length} executed successfully`);
        }
      } catch (error: any) {
        console.error(`❌ Error in statement ${index + 1}:`, error.message);
      }
    }

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
      .order('table_name');

    if (tablesError) {
      console.error('❌ Error verifying tables:', tablesError.message);
      return;
    }

    const tableNames = tables?.map(row => row.table_name) || [];
    console.log('📋 Created tables:', tableNames);

    const expectedTables = ['users', 'clients', 'products', 'invoices', 'invoice_lines', 'payments'];
    const missingTables = expectedTables.filter(table => !tableNames.includes(table));

    if (missingTables.length === 0) {
      console.log('✅ All tables created successfully!');
      
      // Update .env file with DATABASE_URL
      console.log('📝 Updating .env file with DATABASE_URL...');
      const envPath = path.join(__dirname, '../../.env');
      let envContent = fs.readFileSync(envPath, 'utf-8');
      
      const dbUrl = `DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.qcnsnmqkykmcikplcihs.supabase.co:5432/postgres`;
      
      if (envContent.includes('# DATABASE_URL=')) {
        envContent = envContent.replace('# DATABASE_URL=postgresql://...', dbUrl);
      } else if (envContent.includes('DATABASE_URL=')) {
        envContent = envContent.replace(/DATABASE_URL=.*/, dbUrl);
      } else {
        envContent += `\n${dbUrl}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ .env file updated with DATABASE_URL placeholder');
      
    } else {
      console.log('⚠️  Missing tables:', missingTables);
    }

    console.log('');
    console.log('🎉 Database setup complete!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Test the bot: npm run dev');
    console.log('2. Migrate existing data: npm run migrate (if you have existing data)');
    console.log('3. Deploy to production: git push to your deployment platform');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('1. Check if your Supabase project is active');
    console.log('2. Verify SUPABASE_SERVICE_KEY is correct');
    console.log('3. Try the manual setup method in SUPABASE_SETUP.md');
    console.log('4. The exec_sql function may not be available - use manual SQL execution instead');
  }
}

createDatabaseSchema().catch(console.error);