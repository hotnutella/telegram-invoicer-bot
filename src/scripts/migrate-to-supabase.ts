// import Database from 'better-sqlite3'; // Commented out since SQLite is no longer used
import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const SQLITE_DB_PATH = process.env.DATABASE_PATH || './database/invoices.db';
const POSTGRES_URL = process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// Check if SQLite database exists
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.log('No SQLite database found. Starting fresh with PostgreSQL.');
  process.exit(0);
}

async function migrateData() {
  console.log('🚀 Starting migration from SQLite to PostgreSQL...');

  // This script is deprecated since we've moved to PostgreSQL
  console.log('⚠️  This migration script is no longer needed.');
  console.log('✅ Bot is now using PostgreSQL directly via Supabase.');
  return;

  // Legacy SQLite migration code (commented out)
  // const sqliteDb = new Database(SQLITE_DB_PATH);
  
  // Connect to PostgreSQL
  const pgPool = new Pool({
    connectionString: POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Create tables in PostgreSQL
    console.log('📋 Creating PostgreSQL tables...');
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await pgPool.query(schemaSql);

    // Legacy migration code removed - using PostgreSQL directly now
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    // Cleanup if needed
  }
}

// Run migration
migrateData().catch(console.error);