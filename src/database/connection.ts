import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// PostgreSQL connection
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export const db = {
  // Execute raw SQL query
  async query(sql: string, params: any[] = []): Promise<any[]> {
    const result = await pgPool.query(sql, params);
    return result.rows;
  },

  // Execute a single query and return first result
  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const result = await pgPool.query(sql, params);
    return result.rows[0] || null;
  },

  // Execute insert/update/delete and return info
  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number }> {
    const result = await pgPool.query(sql, params);
    return { affectedRows: result.rowCount || 0 };
  },

  // Execute multiple statements (for migrations)
  async exec(sql: string): Promise<void> {
    await pgPool.query(sql);
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