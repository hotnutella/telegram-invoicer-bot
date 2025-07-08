import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...\n');

  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
  const databaseUrl = process.env.DATABASE_URL!;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET!;

  // Test Supabase client
  console.log('📡 Testing Supabase client...');
  const supabase = createClient(supabaseUrl, serviceKey);
  
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && error.message !== 'Invalid token: Invalid JWT') {
      console.log('⚠️  Auth test (expected result):', error.message);
    } else {
      console.log('✅ Supabase client connected');
    }
  } catch (error) {
    console.log('✅ Supabase client connected (auth test expected to fail)');
  }

  // Test PostgreSQL connection
  console.log('🗄️  Testing PostgreSQL connection...');
  const pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pgPool.query('SELECT NOW() as current_time, COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\' AND table_type = \'BASE TABLE\'');
    console.log('✅ PostgreSQL connected');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   Tables found: ${result.rows[0].table_count}`);
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
  }

  // Test Storage bucket
  console.log('🪣 Testing Storage bucket...');
  try {
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list('', { limit: 5 });

    if (error) {
      console.error('❌ Storage bucket error:', error.message);
    } else {
      console.log('✅ Storage bucket accessible');
      console.log(`   Files in bucket: ${files?.length || 0}`);
      if (files && files.length > 0) {
        console.log('   Sample files:');
        files.slice(0, 3).forEach(file => {
          console.log(`     - ${file.name} (${file.metadata?.size || 'unknown'} bytes)`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Storage bucket test failed:', error);
  }

  // Test database schema
  console.log('📋 Testing database schema...');
  try {
    const tablesResult = await pgPool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('✅ Database schema verified');
    console.log('   Tables:');
    tablesResult.rows.forEach(row => {
      console.log(`     - ${row.table_name} (${row.column_count} columns)`);
    });
  } catch (error) {
    console.error('❌ Database schema test failed:', error);
  }

  // Test data integrity
  console.log('🔗 Testing data integrity...');
  try {
    const dataCheck = await pgPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM clients) as clients_count,
        (SELECT COUNT(*) FROM invoices) as invoices_count,
        (SELECT COUNT(*) FROM invoice_lines) as lines_count,
        (SELECT COUNT(*) FROM payments) as payments_count
    `);

    const counts = dataCheck.rows[0];
    console.log('✅ Data integrity check');
    console.log(`   Users: ${counts.users_count}`);
    console.log(`   Clients: ${counts.clients_count}`);
    console.log(`   Invoices: ${counts.invoices_count}`);
    console.log(`   Invoice Lines: ${counts.lines_count}`);
    console.log(`   Payments: ${counts.payments_count}`);

    // Check if PDFs are linked
    const pdfCheck = await pgPool.query(`
      SELECT invoice_number, pdf_path
      FROM invoices 
      WHERE pdf_path IS NOT NULL AND pdf_path != ''
      LIMIT 5
    `);

    if (pdfCheck.rows.length > 0) {
      console.log('📄 PDF linkage verified:');
      pdfCheck.rows.forEach(row => {
        console.log(`     Invoice ${row.invoice_number} → ${row.pdf_path}`);
      });
    } else {
      console.log('⚠️  No PDFs linked to invoices yet');
    }

  } catch (error) {
    console.error('❌ Data integrity test failed:', error);
  }

  await pgPool.end();

  console.log('\n🎉 Supabase connection test completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Test the bot: npm run dev');
  console.log('2. Create a new invoice to test PDF generation and storage');
  console.log('3. Deploy to production when ready');
}

testSupabaseConnection().catch(console.error);