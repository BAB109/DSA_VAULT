import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function runMigrations() {
  console.log('🚀 Checking PostgreSQL connection...');

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Successfully connected to database.');
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL database:');
    console.error(`   ${err.message}`);
    console.error('\nPlease ensure:');
    console.error(' 1. PostgreSQL is running.');
    console.error(' 2. The database specified in your .env file exists.');
    console.error(' 3. Your credentials in .env are correct.');
    await pool.end().catch(() => {});
    process.exit(1);
  }

  try {
    await client.query('BEGIN');
    await ensureMigrationTable(client);

    // Get already applied migrations
    const { rows: appliedRows } = await client.query(
      'SELECT migration_name FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

    // Read migration files in alphabetical order
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (!appliedSet.has(file)) {
        console.log(`⏳ Applying migration: ${file}...`);
        const filePath = path.join(MIGRATIONS_DIR, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
          [file]
        );
        console.log(`✅ Applied: ${file}`);
        count++;
      } else {
        console.log(`⏩ Skipping already applied migration: ${file}`);
      }
    }

    await client.query('COMMIT');

    if (count === 0) {
      console.log('✨ All migrations are up to date. No pending migrations.');
    } else {
      console.log(`🎉 Successfully applied ${count} new migration(s).`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Migration failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute if invoked directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations();
}
