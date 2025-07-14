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

// Resolve hostname to IPv4 address to avoid IPv6 issues
async function resolveToIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    lookup(hostname, { family: 4 }, (err, address) => {
      if (err) {
        console.warn(`Failed to resolve ${hostname} to IPv4, using hostname:`, err.message);
        resolve(hostname); // Fallback to hostname
      } else {
        console.log(`Resolved ${hostname} to IPv4: ${address}`);
        resolve(address);
      }
    });
  });
}

// PostgreSQL connection with IPv4 forcing for Railway
const connectionConfig = process.env.DATABASE_URL 
  ? parseConnectionString(process.env.DATABASE_URL)
  : {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: ''
    };

// Create connection pool with IPv4 resolution
async function createPool() {
  let host = connectionConfig.host;
  
  // For production (Railway), resolve hostname to IPv4
  if (isProduction && host && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    try {
      host = await resolveToIPv4(host);
    } catch (error) {
      console.warn('Failed to resolve hostname to IPv4:', error);
    }
  }
  
  return new Pool({
    host: host,
    port: connectionConfig.port,
    database: connectionConfig.database,
    user: connectionConfig.user,
    password: connectionConfig.password,
    
    // SSL configuration
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    
    // Railway-specific optimizations
    max: 10, // Maximum connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
    query_timeout: 30000, // Timeout queries after 30 seconds
    
    // Additional connection options
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
}

// Initialize pool
let pgPool: Pool;

// Initialize pool asynchronously
(async () => {
  try {
    pgPool = await createPool();
    console.log('✅ Database pool created successfully');
  } catch (error) {
    console.error('❌ Failed to create database pool:', error);
    // Fallback to basic connection without IPv4 resolution
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });
  }
})();

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