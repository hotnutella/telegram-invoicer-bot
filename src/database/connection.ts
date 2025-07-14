import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
}

// Supabase REST API client
class SupabaseRestClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = `${SUPABASE_URL!}/rest/v1`;
    this.headers = {
      'apikey': SUPABASE_SERVICE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY!}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
  }

  // Execute a SELECT query
  async query(table: string, options: {
    select?: string;
    eq?: Record<string, any>;
    order?: string;
    limit?: number;
    single?: boolean;
  } = {}): Promise<any[]> {
    try {
      let url = `${this.baseUrl}/${table}`;
      const params = new URLSearchParams();

      if (options.select) {
        params.append('select', options.select);
      }

      if (options.eq) {
        Object.entries(options.eq).forEach(([key, value]) => {
          params.append(`${key}`, `eq.${value}`);
        });
      }

      if (options.order) {
        params.append('order', options.order);
      }

      if (options.limit) {
        params.append('limit', options.limit.toString());
      }

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`Supabase API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return options.single ? [data] : data;
    } catch (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
  }

  // Execute a single SELECT query (returns first result)
  async queryOne(table: string, options: {
    select?: string;
    eq?: Record<string, any>;
  } = {}): Promise<any | null> {
    try {
      const results = await this.query(table, { ...options, limit: 1 });
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('Supabase queryOne error:', error);
      throw error;
    }
  }

  // Execute an INSERT
  async insert(table: string, data: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/${table}`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase insert error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return Array.isArray(result) ? result[0] : result;
    } catch (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
  }

  // Execute an UPDATE
  async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<{ affectedRows: number }> {
    try {
      let url = `${this.baseUrl}/${table}`;
      const params = new URLSearchParams();

      Object.entries(where).forEach(([key, value]) => {
        params.append(`${key}`, `eq.${value}`);
      });

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase update error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Supabase doesn't return affected rows count in the same way
      // We'll return 1 for successful updates
      return { affectedRows: 1 };
    } catch (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
  }

  // Execute a DELETE
  async delete(table: string, where: Record<string, any>): Promise<{ affectedRows: number }> {
    try {
      let url = `${this.baseUrl}/${table}`;
      const params = new URLSearchParams();

      Object.entries(where).forEach(([key, value]) => {
        params.append(`${key}`, `eq.${value}`);
      });

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase delete error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return { affectedRows: 1 };
    } catch (error) {
      console.error('Supabase delete error:', error);
      throw error;
    }
  }

  // Execute raw SQL (for complex queries)
  async rawQuery(query: string, params: any[] = []): Promise<any[]> {
    try {
      // For complex queries, we'll use Supabase's RPC function
      console.warn('Raw SQL queries are not directly supported with REST API. Consider using specific methods.');
      return [];
    } catch (error) {
      console.error('Supabase raw query error:', error);
      throw error;
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/users?limit=1`, {
        method: 'GET',
        headers: this.headers
      });
      
      console.log(`✅ Supabase REST API connection test: ${response.status}`);
      return response.ok;
    } catch (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
  }
}

// Create the client instance
const supabaseClient = new SupabaseRestClient();

// Export compatible interface similar to the old pg-based db
export const db = {
  // Execute raw SQL query (adapted for REST API)
  async query(sql: string, params: any[] = []): Promise<any[]> {
    console.warn('Raw SQL queries are not supported with REST API. Use specific methods instead.');
    return [];
  },

  // Execute a single query and return first result (adapted for REST API)
  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    console.warn('Raw SQL queries are not supported with REST API. Use specific methods instead.');
    return null;
  },

  // Execute insert/update/delete (adapted for REST API)
  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number }> {
    console.warn('Raw SQL queries are not supported with REST API. Use specific methods instead.');
    return { affectedRows: 0 };
  },

  // Execute multiple statements (not needed for REST API)
  async exec(sql: string): Promise<void> {
    console.warn('Raw SQL execution is not supported with REST API.');
  },

  // Test database connection
  async testConnection(): Promise<boolean> {
    return await supabaseClient.testConnection();
  },

  // Close connection (not needed for REST API)
  async close(): Promise<void> {
    console.log('✅ Supabase REST API client closed');
  },

  // Get database type
  getType(): 'supabase' {
    return 'supabase';
  },

  // Expose the Supabase client for direct use
  client: supabaseClient
};

export default db;