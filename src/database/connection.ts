import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// PostgreSQL connection with enhanced configuration for Railway
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Force IPv4 and add Railway-specific optimizations
  host: isProduction ? process.env.DATABASE_URL?.match(/\/\/([^:]+)/)?.[1] : undefined,
  max: 10, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
  // Retry configuration
  query_timeout: 30000, // Timeout queries after 30 seconds
});

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