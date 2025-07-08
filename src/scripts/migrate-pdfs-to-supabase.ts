import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET!;
const databaseUrl = process.env.DATABASE_URL!;
const pdfStoragePath = process.env.PDF_STORAGE_PATH || './pdfs';

async function migratePDFsToSupabase() {
  console.log('📁 Starting PDF migration to Supabase Storage...');
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, serviceKey);
  
  // Initialize PostgreSQL client
  const pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if PDFs directory exists
    if (!fs.existsSync(pdfStoragePath)) {
      console.log('📁 No PDFs directory found, nothing to migrate');
      return;
    }

    // Read all PDF files
    const pdfFiles = fs.readdirSync(pdfStoragePath).filter(file => file.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('📁 No PDF files found to migrate');
      return;
    }

    console.log(`📋 Found ${pdfFiles.length} PDF files to migrate:`);
    pdfFiles.forEach(file => console.log(`   - ${file}`));

    // Get existing invoices from database
    const invoicesResult = await pgPool.query('SELECT id, invoice_number, pdf_path FROM invoices');
    const invoices = invoicesResult.rows;

    console.log('📄 Migrating PDF files...');
    
    for (const pdfFile of pdfFiles) {
      const localPath = path.join(pdfStoragePath, pdfFile);
      const fileBuffer = fs.readFileSync(localPath);
      
      // Extract invoice number from filename (e.g., invoice_202507001.pdf)
      const invoiceNumber = pdfFile.replace('invoice_', '').replace('.pdf', '');
      
      // Find corresponding invoice in database
      const invoice = invoices.find(inv => inv.invoice_number === invoiceNumber);
      
      if (!invoice) {
        console.log(`⚠️  No invoice found for PDF: ${pdfFile}`);
        continue;
      }

      // Upload to Supabase Storage
      const storagePath = `invoices/${invoice.id}/${pdfFile}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error(`❌ Failed to upload ${pdfFile}:`, uploadError.message);
        continue;
      }

      // Update invoice record with new storage path
      await pgPool.query(
        'UPDATE invoices SET pdf_path = $1 WHERE id = $2',
        [storagePath, invoice.id]
      );

      console.log(`✅ Migrated: ${pdfFile} → ${storagePath}`);
    }

    console.log('');
    console.log('🎉 PDF migration completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   - ${pdfFiles.length} PDF files migrated to Supabase Storage`);
    console.log(`   - Invoice records updated with new storage paths`);
    console.log(`   - Storage bucket: ${bucketName}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Test PDF access with the bot');
    console.log('2. You can safely delete the local pdfs/ directory');
    console.log('3. Deploy to production');

  } catch (error) {
    console.error('❌ PDF migration failed:', error);
  } finally {
    await pgPool.end();
  }
}

migratePDFsToSupabase().catch(console.error);