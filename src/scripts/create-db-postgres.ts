import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function createDatabaseSchema() {
  console.log('🚀 Creating database schema via PostgreSQL connection...');
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ Missing DATABASE_URL in .env file');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connection
    console.log('🔍 Testing database connection...');
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', testResult.rows[0].now);

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

    for (const [index, statement] of statements.entries()) {
      try {
        await pool.query(statement);
        console.log(`✅ Statement ${index + 1}/${statements.length} executed successfully`);
      } catch (error: any) {
        if (error.code === '42P07') {
          console.log(`⚠️  Table already exists (${index + 1}/${statements.length})`);
        } else if (error.code === '42P01') {
          console.log(`⚠️  Relation already exists (${index + 1}/${statements.length})`);
        } else {
          console.error(`❌ Error in statement ${index + 1}:`, error.message);
        }
      }
    }

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    console.log('📋 Created tables:', tables);

    const expectedTables = ['users', 'clients', 'products', 'invoices', 'invoice_lines', 'payments'];
    const missingTables = expectedTables.filter(table => !tables.includes(table));

    if (missingTables.length === 0) {
      console.log('✅ All tables created successfully!');
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
    console.log('2. Verify DATABASE_URL is correct');
    console.log('3. Check if the database password is correct');
  } finally {
    await pool.end();
  }
}

createDatabaseSchema().catch(console.error);