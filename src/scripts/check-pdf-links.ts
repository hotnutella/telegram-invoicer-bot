import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkPDFLinks() {
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📋 Checking PDF links in database...');
    
    const result = await pgPool.query('SELECT id, invoice_number, pdf_path FROM invoices');
    
    console.log('📄 Current invoice records:');
    result.rows.forEach(row => {
      console.log(`   Invoice #${row.invoice_number} (ID: ${row.id})`);
      console.log(`   PDF Path: ${row.pdf_path || 'NOT SET'}`);
      console.log('');
    });

    if (result.rows.length === 0) {
      console.log('   No invoices found');
    }
    
  } catch (error) {
    console.error('❌ Error checking PDF links:', error);
  } finally {
    await pgPool.end();
  }
}

checkPDFLinks().catch(console.error);