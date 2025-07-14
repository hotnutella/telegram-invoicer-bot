import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { lookup } from 'dns';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Parse DATABASE_URL to extract connection components
function parseConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1), // Remove leading slash
    user: url.username,
    password: url.password,
  };
}



// Initialize pool synchronously with fallback
let pgPool: Pool;

// Resolve hostname to IPv4 address synchronously
function resolveHostnameToIPv4(hostname: string): string {
  try {
    console.log(`🔍 Resolving ${hostname} to IPv4...`);
    
    // Use synchronous DNS lookup (this blocks but is necessary)
    const util = require('util');
    const lookupPromise = util.promisify(lookup);
    
    // We need to wrap this in a Promise that resolves synchronously
    // For now, let's use a different approach - try to get IPv4 first
    
    // For the Supabase hostname, we can try to use a different approach
    // Let's try to replace with a connection pooler endpoint if available
    if (hostname.includes('supabase.co')) {
      // Try connection pooler endpoint (often has better IPv4 support)
      const poolerHostname = hostname.replace('db.', '').replace('.supabase.co', '.pooler.supabase.com');
      console.log(`🔄 Trying connection pooler: ${poolerHostname}`);
      return poolerHostname;
    }
    
    return hostname; // Fallback to original hostname
  } catch (error) {
    console.warn(`❌ Failed to resolve ${hostname}:`, error);
    return hostname; // Fallback to original hostname
  }
}

// Create pool with fallback to connection string
function initializePool(): Pool {
  try {
    // For production, try to create pool with IPv4 resolution
    if (isProduction && process.env.DATABASE_URL) {
      console.log('🔄 Attempting to create pool with IPv4 resolution...');
      
      const config = parseConnectionString(process.env.DATABASE_URL);
      
      // Try to resolve hostname to IPv4 or use connection pooler
      const resolvedHost = resolveHostnameToIPv4(config.host);
      
      console.log(`📡 Using host: ${resolvedHost}`);
      
      // Create pool with resolved host
      return new Pool({
        host: resolvedHost,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        query_timeout: 30000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
    } else {
      // Development mode - use connection string
      return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        query_timeout: 30000,
      });
    }
  } catch (error) {
    console.warn('❌ Failed to create pool with parsed config, falling back to connection string:', error);
    // Fallback to basic connection string
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });
  }
}

// Initialize pool immediately
pgPool = initializePool();
console.log('✅ Database pool initialized');

// Helper function to retry database operations
async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`Database operation failed (attempt ${i + 1}/${maxRetries}):`, error);
      
      if (i < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError;
}

export const db = {
  // Execute raw SQL query with retry logic
  async query(sql: string, params: any[] = []): Promise<any[]> {
    return retryOperation(async () => {
      const result = await pgPool.query(sql, params);
      return result.rows;
    });
  },

  // Execute a single query and return first result
  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    return retryOperation(async () => {
      const result = await pgPool.query(sql, params);
      return result.rows[0] || null;
    });
  },

  // Execute insert/update/delete and return info
  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number }> {
    return retryOperation(async () => {
      const result = await pgPool.query(sql, params);
      return { affectedRows: result.rowCount || 0 };
    });
  },

  // Execute multiple statements (for migrations)
  async exec(sql: string): Promise<void> {
    return retryOperation(async () => {
      await pgPool.query(sql);
    });
  },

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      await pgPool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  },

  // Close connection
  async close(): Promise<void> {
    await pgPool.end();
  },

  // Get database type
  getType(): 'postgresql' {
    return 'postgresql';
  }
};

export default db;