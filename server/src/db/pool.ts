import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
});

export default pool;
