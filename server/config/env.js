import dotenv from 'dotenv';

dotenv.config();

export const FORBIDDEN_ADMIN_USERNAMES = ['admin', 'administrator', 'root'];

export const ADMIN_SESSION_DEFAULTS = {
  IDLE_MINUTES: 120,
  MIN_IDLE_MINUTES: 15,
  MAX_IDLE_MINUTES: 480,
  MAX_HOURS: 12,
  MIN_MAX_HOURS: 1,
  MAX_MAX_HOURS: 24,
};

/**
 * Returns parsed and validated admin session duration configuration in minutes, hours, and seconds.
 */
export function getAdminSessionConfig(env = process.env) {
  let idleMinutes = env.ADMIN_SESSION_IDLE_MINUTES !== undefined && env.ADMIN_SESSION_IDLE_MINUTES !== ''
    ? Number(env.ADMIN_SESSION_IDLE_MINUTES)
    : ADMIN_SESSION_DEFAULTS.IDLE_MINUTES;

  let maxHours = env.ADMIN_SESSION_MAX_HOURS !== undefined && env.ADMIN_SESSION_MAX_HOURS !== ''
    ? Number(env.ADMIN_SESSION_MAX_HOURS)
    : ADMIN_SESSION_DEFAULTS.MAX_HOURS;

  if (Number.isNaN(idleMinutes)) {
    idleMinutes = ADMIN_SESSION_DEFAULTS.IDLE_MINUTES;
  }
  if (Number.isNaN(maxHours)) {
    maxHours = ADMIN_SESSION_DEFAULTS.MAX_HOURS;
  }

  return {
    idleMinutes,
    idleSeconds: idleMinutes * 60,
    maxHours,
    maxSeconds: maxHours * 3600,
  };
}

/**
 * Validates admin configuration specifically.
 * Can be called standalone for unit testing validation logic.
 */
export function validateAdminEnv(env = process.env, isProduction = (env.NODE_ENV === 'production')) {
  const adminUsername = env.ADMIN_USERNAME ? env.ADMIN_USERNAME.trim() : '';
  const adminPassword = env.ADMIN_PASSWORD || '';
  const adminJwtSecret = env.ADMIN_JWT_SECRET || '';

  const errors = [];
  const warnings = [];

  const isConfigured = Boolean(adminUsername && adminPassword && adminJwtSecret);

  // Validate session idle and max bounds
  const rawIdle = env.ADMIN_SESSION_IDLE_MINUTES;
  if (rawIdle !== undefined && rawIdle !== '') {
    const idleNum = Number(rawIdle);
    if (!Number.isInteger(idleNum) || idleNum < ADMIN_SESSION_DEFAULTS.MIN_IDLE_MINUTES || idleNum > ADMIN_SESSION_DEFAULTS.MAX_IDLE_MINUTES) {
      const msg = `ADMIN_SESSION_IDLE_MINUTES must be an integer between ${ADMIN_SESSION_DEFAULTS.MIN_IDLE_MINUTES} and ${ADMIN_SESSION_DEFAULTS.MAX_IDLE_MINUTES} (received: ${rawIdle}).`;
      if (isProduction) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  const rawMax = env.ADMIN_SESSION_MAX_HOURS;
  if (rawMax !== undefined && rawMax !== '') {
    const maxNum = Number(rawMax);
    if (!Number.isInteger(maxNum) || maxNum < ADMIN_SESSION_DEFAULTS.MIN_MAX_HOURS || maxNum > ADMIN_SESSION_DEFAULTS.MAX_MAX_HOURS) {
      const msg = `ADMIN_SESSION_MAX_HOURS must be an integer between ${ADMIN_SESSION_DEFAULTS.MIN_MAX_HOURS} and ${ADMIN_SESSION_DEFAULTS.MAX_MAX_HOURS} (received: ${rawMax}).`;
      if (isProduction) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
    }
  }

  if (isProduction) {
    if (!adminUsername || !adminPassword || !adminJwtSecret) {
      errors.push('ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_JWT_SECRET are all required in production.');
    } else {
      if (adminPassword.length < 12) {
        errors.push('ADMIN_PASSWORD must be at least 12 characters long in production.');
      }
      if (adminJwtSecret.length < 32) {
        errors.push('ADMIN_JWT_SECRET must be at least 32 characters long in production.');
      }
      if (FORBIDDEN_ADMIN_USERNAMES.includes(adminUsername.toLowerCase())) {
        errors.push(`ADMIN_USERNAME cannot be '${adminUsername.toLowerCase()}'. Choose a non-standard username.`);
      }
    }
  } else {
    if (!isConfigured) {
      warnings.push('Admin credentials not fully configured (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_JWT_SECRET). Admin login is disabled.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    isConfigured,
  };
}

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

  // 2. Admin Credentials & Secret Validation
  const adminValidation = validateAdminEnv(process.env, isProduction);
  if (adminValidation.errors.length > 0) {
    errors.push(...adminValidation.errors);
  }
  if (adminValidation.warnings.length > 0) {
    warnings.push(...adminValidation.warnings);
  }

  // 3. Database Configuration
  const hasDbConfig = Boolean(dbUrl || pgHost || process.env.PGDATABASE);
  if (!hasDbConfig && isProduction) {
    warnings.push('No PostgreSQL configuration found (DATABASE_URL or PGHOST). Server will use in-memory store.');
  }

  // 4. CORS / Client URL Configuration
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
    adminUsername: adminValidation.isConfigured ? (process.env.ADMIN_USERNAME || '').trim() : null,
    isAdminConfigured: adminValidation.isConfigured,
  };
}

export const envConfig = validateEnv();
