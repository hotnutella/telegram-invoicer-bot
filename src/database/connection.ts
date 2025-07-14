import { Pool } from 'pg';
import * as dotenv from 'dotenv';

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

// Create pool with fallback to connection string
function initializePool(): Pool {
  try {
    // For production, try to create pool with IPv4 resolution
    if (isProduction && process.env.DATABASE_URL) {
      console.log('🔄 Attempting to create pool with IPv4 resolution...');
      
      // Try to resolve hostname synchronously (with timeout)
      const config = parseConnectionString(process.env.DATABASE_URL);
      
      // Create pool with parsed config first
      return new Pool({
        host: config.host,
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