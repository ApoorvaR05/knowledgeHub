import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', err => {
  console.error('Unexpected PostgreSQL pool error', err);
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<import('pg').QueryResult<T & import('pg').QueryResultRow>> {
  const start = Date.now();
  const result = await pool.query<T & import('pg').QueryResultRow>(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'test') {
    console.debug(`[db] query="${text.slice(0, 60)}…" duration=${duration}ms rows=${result.rowCount}`);
  }
  return result;
}

// Default export for compatibility with Dev A's routes that import pool directly
export default pool;
