import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupSupabaseManual() {
  console.log('🚀 Supabase Manual Setup Guide');
  console.log('');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
    console.log('');
    console.log('Please make sure you have these variables in your .env file:');
    console.log('SUPABASE_URL=https://your-project.supabase.co');
    console.log('SUPABASE_SERVICE_KEY=your-service-key');
    return;
  }
  
  const projectRef = supabaseUrl.replace('https://', '').replace('http://', '').split('.')[0];
  
  console.log('📋 **Step 1: Create Database Schema**');
  console.log('');
  console.log('1. Go to Supabase Dashboard:');
  console.log(`   https://app.supabase.com/project/${projectRef}`);
  console.log('');
  console.log('2. Navigate to SQL Editor');
  console.log('');
  console.log('3. Copy and paste the following SQL:');
  console.log('');
  console.log('```sql');
  
  // Read and display schema
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  console.log(schemaSql);
  console.log('```');
  console.log('');
  
  console.log('4. Click "RUN" to execute the SQL');
  console.log('');
  
  console.log('📋 **Step 2: Update .env file**');
  console.log('');
  console.log('Add the following line to your .env file:');
  console.log('');
  console.log(`DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`);
  console.log('');
  console.log('Replace [YOUR_PASSWORD] with your actual database password from Supabase Dashboard > Settings > Database');
  console.log('');
  
  console.log('📋 **Step 3: Test the Setup**');
  console.log('');
  console.log('Run the following commands:');
  console.log('');
  console.log('# Test the bot');
  console.log('npm run dev');
  console.log('');
  console.log('# If you have existing data, migrate it');
  console.log('npm run migrate');
  console.log('');
  
  console.log('🎉 Setup complete! Your bot is ready to use with Supabase.');
}

setupSupabaseManual().catch(console.error);