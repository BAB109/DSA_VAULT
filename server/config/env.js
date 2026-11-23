import dotenv from 'dotenv';

dotenv.config();

/**
 * Validates and normalizes environment variables for DSA Vault.
 * Exits or logs warnings if required variables are missing or unsafe in production.
 */
export function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  const port = process.env.PORT || 5000;
  const jwtSecret = process.env.JWT_SECRET;
  const dbUrl = process.env.DATABASE_URL;
  const pgHost = process.env.PGHOST;
  const clientUrl = process.env.CLIENT_URL;

  // 1. JWT Secret Validation
  if (!jwtSecret) {
    if (isProduction) {
      errors.push('JWT_SECRET environment variable is required in production.');
    } else {
      warnings.push('JWT_SECRET is not set; using insecure default development secret.');
    }
  } else if (jwtSecret.length < 32) {
    if (isProduction) {
      errors.push('JWT_SECRET must be at least 32 characters long in production.');
    } else {
      warnings.push('JWT_SECRET is shorter than 32 characters; consider using a longer secret.');
    }
  }

  // 2. Database Configuration
  const hasDbConfig = Boolean(dbUrl || pgHost || process.env.PGDATABASE);
  if (!hasDbConfig && isProduction) {
    warnings.push('No PostgreSQL configuration found (DATABASE_URL or PGHOST). Server will use in-memory store.');
  }

  // 3. CORS / Client URL Configuration
  if (isProduction && !clientUrl) {
    warnings.push('CLIENT_URL is not defined in production; CORS will allow all origins if not restricted.');
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Configuration Warnings:');
    for (const w of warnings) {
      console.warn(`   • ${w}`);
    }
    console.warn('');
  }

  if (errors.length > 0) {
    console.error('\n❌ Fatal Environment Configuration Errors:');
    for (const e of errors) {
      console.error(`   • ${e}`);
    }
    console.error('\nPlease update your environment variables or .env file before starting.\n');
    process.exit(1);
  }

  return {
    isProduction,
    port: parseInt(port, 10),
    jwtSecret: jwtSecret || 'fallback_development_secret_change_in_production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    clientUrl: clientUrl || null,
  };
}

export const envConfig = validateEnv();
