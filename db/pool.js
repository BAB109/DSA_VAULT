import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

function isValidConnectionString(cs) {
  if (!cs || typeof cs !== 'string') return false;
  const trimmed = cs.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) return false;
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.hostname && parsed.hostname.length > 2 && parsed.hostname !== 'localhost.invalid');
  } catch {
    return false;
  }
}

function hasValidDiscreteCredentials() {
  const host = process.env.PGHOST;
  const password = process.env.PGPASSWORD;
  if (!host || host === 'postgres' || !password || password === 'your_secure_db_password') {
    return false;
  }
  return true;
}

const rawConnectionString = process.env.DATABASE_URL;
const connectionString = isValidConnectionString(rawConnectionString) ? rawConnectionString.trim() : null;
const isDbConfigured = Boolean(connectionString || hasValidDiscreteCredentials());

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

let poolInstance = null;

if (isDbConfigured) {
  const poolConfig = connectionString
    ? {
        connectionString,
        ssl: sslConfig,
        max: parseInt(process.env.PGMAX_CONNECTIONS || '10', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000, // Fast 2s timeout
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'dsa_vault',
        user: process.env.PGUSER || 'postgres',
        ...(process.env.PGPASSWORD ? { password: String(process.env.PGPASSWORD) } : {}),
        ssl: sslConfig,
        max: parseInt(process.env.PGMAX_CONNECTIONS || '10', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      };

  poolInstance = new Pool(poolConfig);
  poolInstance.on('error', (err) => {
    console.warn('⚠️  PostgreSQL pool error:', err.message);
  });
}

// Resilient pool wrapper
export const pool = {
  async connect() {
    if (!poolInstance) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
    return poolInstance.connect();
  },
  async query(text, params) {
    if (!poolInstance) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
    return poolInstance.query(text, params);
  },
  async end() {
    if (poolInstance) {
      return poolInstance.end();
    }
  },
  on(event, handler) {
    if (poolInstance) {
      poolInstance.on(event, handler);
    }
  },
};

export const query = (text, params) => pool.query(text, params);

export default {
  pool,
  query,
};
