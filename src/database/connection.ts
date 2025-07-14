import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { lookup } from 'dns';
import { promisify } from 'util';

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



// Async function to resolve hostname to IPv4
const lookupAsync = promisify(lookup);

async function resolveHostnameToIPv4(hostname: string): Promise<string> {
  try {
    console.log(`🔍 Resolving ${hostname} to IPv4...`);
    const { address } = await lookupAsync(hostname, { family: 4 });
    console.log(`✅ Resolved ${hostname} to IPv4: ${address}`);
    return address;
  } catch (error) {
    console.warn(`❌ Failed to resolve ${hostname} to IPv4:`, error instanceof Error ? error.message : String(error));
    return hostname; // Fallback to original hostname
  }
}

// Function to create modified DATABASE_URL with IPv4 address
async function createIPv4DatabaseUrl(originalUrl: string): Promise<string> {
  try {
    const config = parseConnectionString(originalUrl);
    const ipv4Address = await resolveHostnameToIPv4(config.host);
    
    // If we got an IP address, replace the hostname in the URL
    if (ipv4Address !== config.host && ipv4Address.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      const modifiedUrl = originalUrl.replace(config.host, ipv4Address);
      console.log(`🔄 Modified DATABASE_URL to use IPv4: ${modifiedUrl.replace(config.password, '[HIDDEN]')}`);
      return modifiedUrl;
    }
    
    return originalUrl;
  } catch (error) {
    console.warn('❌ Failed to create IPv4 database URL:', error instanceof Error ? error.message : String(error));
    return originalUrl;
  }
}

// Initialize pool synchronously with fallback
let pgPool: Pool;

// Create pool with IPv4 resolution
async function initializePool(): Promise<Pool> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // For production, try to resolve hostname to IPv4 first
  if (isProduction) {
    console.log('🔄 Production mode: attempting IPv4 resolution...');
    
    try {
      const ipv4DatabaseUrl = await createIPv4DatabaseUrl(process.env.DATABASE_URL);
      
      console.log('📡 Creating pool with IPv4-resolved URL');
      return new Pool({
        connectionString: ipv4DatabaseUrl,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        query_timeout: 30000,
      });
    } catch (error) {
      console.warn('❌ IPv4 resolution failed, using original URL:', error instanceof Error ? error.message : String(error));
      
      // Fallback to original URL
      return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        query_timeout: 30000,
      });
    }
  } else {
    // Development mode - use connection string
    console.log('🔧 Development mode - using connection string');
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });
  }
}

// Initialize pool asynchronously
let poolInitialized = false;

// Initialize pool and set global variable
(async () => {
  try {
    pgPool = await initializePool();
    poolInitialized = true;
    console.log('✅ Database pool initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database pool:', error);
    // Fallback to basic pool
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 5000,
    });
    poolInitialized = true;
    console.log('✅ Database pool initialized with fallback');
  }
})();

// Helper function to wait for pool initialization
async function waitForPoolInitialization(): Promise<void> {
  while (!poolInitialized) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Helper function to retry database operations
async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  // Wait for pool to be initialized
  await waitForPoolInitialization();
  
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