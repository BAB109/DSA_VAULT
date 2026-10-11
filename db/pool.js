import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const { Pool } = pg;

// Construct connection config based on either DATABASE_URL or standard PG* env vars
const connectionString = process.env.DATABASE_URL;

function determineSslConfig() {
  if (process.env.PGSSL === 'false') return false;
  if (process.env.PGSSL === 'true') {
    return { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' };
  }
  if (connectionString) {
    const isCloudManaged =
      connectionString.includes('sslmode=require') ||
      connectionString.includes('neon.tech') ||
      connectionString.includes('supabase.co') ||
      connectionString.includes('render.com') ||
      connectionString.includes('railway.app') ||
      connectionString.includes('aivencloud.com');
    if (isCloudManaged) {
      return { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' };
    }
  }
  return false;
}

const sslConfig = determineSslConfig();

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: sslConfig,
      max: parseInt(process.env.PGMAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'dsa_vault',
      user: process.env.PGUSER || 'postgres',
      ...(process.env.PGPASSWORD ? { password: String(process.env.PGPASSWORD) } : {}),
      ssl: sslConfig,
      max: parseInt(process.env.PGMAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

export const pool = new Pool(poolConfig);

// Helper query function
export const query = (text, params) => pool.query(text, params);

export default {
  pool,
  query,
};
