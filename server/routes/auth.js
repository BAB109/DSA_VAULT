import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { pool } from '../../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';
import { getAdminSessionConfig } from '../config/env.js';
import { writeAuditLog } from './admin.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 12;

// Dummy bcrypt hash for constant-time comparisons when username is unknown
const DUMMY_BCRYPT_HASH = '$2b$12$e8p.nCg8NnL29.XQ712aE.iN7t3E309zZ7aR3eD8U3wG99j809qGy';

// In-memory failure tracking for login rate limiting:
// 1. ipFailures: Map(ip -> number[]) timestamp array of failures from that IP
// 2. ipUserFailures: Map(`${ip}:${username}` -> number[]) timestamp array of failures
// 3. userFailures: Map(username -> number[]) timestamp array of failures across all IPs
const ipFailures = new Map();
const ipUserFailures = new Map();
const userFailures = new Map();

export function resetLoginFailureTracking() {
  ipFailures.clear();
  ipUserFailures.clear();
  userFailures.clear();
}

/**
 * Prunes expired timestamps older than windowMs.
 */
function pruneTimestamps(timestamps, windowMs, now) {
  return timestamps.filter((t) => now - t < windowMs);
}

/**
 * Record a login failure for IP and Username.
 */
function recordLoginFailure(ip, username) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;

  // 1. IP
  const currentIp = pruneTimestamps(ipFailures.get(ip) || [], windowMs, now);
  currentIp.push(now);
  ipFailures.set(ip, currentIp);

  // 2. IP + Username
  if (username) {
    const key = `${ip}:${username}`;
    const currentIpUser = pruneTimestamps(ipUserFailures.get(key) || [], windowMs, now);
    currentIpUser.push(now);
    ipUserFailures.set(key, currentIpUser);

    // 3. Username across all IPs
    const currentUser = pruneTimestamps(userFailures.get(username) || [], windowMs, now);
    currentUser.push(now);
    userFailures.set(username, currentUser);
  }
}

/**
 * Middleware: Rate limiting and progressive delay on POST /api/auth/login.
 * Rules:
 * - 5 failures per 15 minutes per (IP + username) pair -> 429
 * - 20 failures per 15 minutes per IP across all usernames -> 429
 * - Progressive delay up to 2s after 5 recent failures for that username across any IP (NEVER 429 on username alone)
 */
async function loginRateLimiter(req, res, next) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';

  // Check IP limit (20 failures per 15 min)
  const currentIpList = pruneTimestamps(ipFailures.get(ip) || [], windowMs, now);
  ipFailures.set(ip, currentIpList);
  if (currentIpList.length >= 20) {
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many failed login attempts from this IP address. Please try again after 15 minutes.',
    });
  }

  // Check IP + Username limit (5 failures per 15 min)
  if (username) {
    const pairKey = `${ip}:${username}`;
    const currentPairList = pruneTimestamps(ipUserFailures.get(pairKey) || [], windowMs, now);
    ipUserFailures.set(pairKey, currentPairList);
    if (currentPairList.length >= 5) {
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many failed login attempts for this account from this IP. Please try again after 15 minutes.',
      });
    }

    // Progressive delay (up to 2000ms) after 5 recent failures for that username across any IP
    const currentUserList = pruneTimestamps(userFailures.get(username) || [], windowMs, now);
    userFailures.set(username, currentUserList);
    if (currentUserList.length >= 5) {
      // 5 failures -> 400ms, 6 -> 800ms, 7 -> 1200ms, 8 -> 1600ms, 9+ -> 2000ms
      const delayMs = Math.min(2000, (currentUserList.length - 4) * 400);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  next();
}

// In-memory user store used when PostgreSQL credentials are not yet configured in .env
const memoryUsers = new Map([
  [
    'demo',
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'demo',
      passwordHash: bcrypt.hashSync('demo1234', 10),
      created_at: new Date().toISOString(),
    },
  ],
]);

// Helper to ensure demo user exists in PostgreSQL with valid UUID
export async function ensureDemoUser() {
  try {
    const hash = bcrypt.hashSync('demo1234', 10);
    await pool.query(
      `INSERT INTO users (id, username, password_hash)
       VALUES ('00000000-0000-0000-0000-000000000001', 'demo', $1)
       ON CONFLICT (username) DO UPDATE SET password_hash = $1`,
      [hash]
    );
  } catch (err) {
    // Non-fatal if DB not yet connected or migrating
  }
}

/**
 * Ensures the configured admin user exists in PostgreSQL with is_admin = true.
 * If user exists, updates password hash only if it no longer matches ADMIN_PASSWORD.
 * Does NOT promote or demote any other accounts.
 */
export async function ensureAdminUser() {
  const adminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim() : '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  if (!adminUsername || !adminPassword) {
    return;
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash, is_admin FROM users WHERE lower(username) = lower($1)',
      [adminUsername]
    );

    if (rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
      await pool.query(
        `INSERT INTO users (username, password_hash, is_admin)
         VALUES ($1, $2, true)
         ON CONFLICT (username) DO UPDATE SET is_admin = true`,
        [adminUsername, hash]
      );
    } else {
      const existing = rows[0];
      const match = await bcrypt.compare(adminPassword, existing.password_hash);
      if (!match) {
        const newHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
        await pool.query(
          'UPDATE users SET password_hash = $1, is_admin = true WHERE id = $2',
          [newHash, existing.id]
        );
      } else if (!existing.is_admin) {
        await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [existing.id]);
      }
    }
  } catch (err) {
    console.warn('⚠️  Could not ensure admin user in database:', err.message);
  }
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// ── Validation Helpers ────────────────────────────────────────────────────────
function validateAuthPayload(username, password) {
  if (!username || typeof username !== 'string') {
    return 'Username is required.';
  }
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 30) {
    return 'Username must be between 3 and 30 characters.';
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(trimmed)) {
    return 'Username must start with a letter/digit and contain only letters, digits, underscores, or hyphens.';
  }
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  return null;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Maximum allowed registered accounts in the system
export const MAX_USERS = parseInt(process.env.MAX_USERS || '5', 10);

// Helper to check current user count in PostgreSQL
async function getUserCount() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  return rows[0]?.count || 0;
}

// ------------------------------------------------------------------------------
// POST /api/auth/register
// ------------------------------------------------------------------------------
router.post('/register', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  const validationError = validateAuthPayload(username, password);
  if (validationError) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: validationError,
    });
  }

  const normalizedUsername = username.trim();
  const lowerUsername = normalizedUsername.toLowerCase();

  // Reject registration of ADMIN_USERNAME (case-insensitive and surrounding whitespace)
  const configuredAdmin = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim().toLowerCase() : '';
  if (configuredAdmin && lowerUsername === configuredAdmin) {
    return res.status(409).json({
      error: 'USERNAME_TAKEN',
      message: 'This username is already taken. Please choose another one.',
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Attempt PostgreSQL user creation with account limit enforcement
    try {
      const currentCount = await getUserCount();
      if (currentCount >= MAX_USERS) {
        return res.status(403).json({
          error: 'ACCOUNT_LIMIT_REACHED',
          message: `Account limit reached. Only ${MAX_USERS} accounts are allowed.`,
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO users (username, password_hash)
         VALUES ($1, $2)
         RETURNING id, username, created_at`,
        [normalizedUsername, passwordHash]
      );

      const newUser = rows[0];
      const token = generateToken(newUser);

      return res.status(201).json({
        message: 'User registered successfully.',
        user: {
          id: newUser.id,
          username: newUser.username,
          created_at: newUser.created_at,
        },
        token,
      });
    } catch (dbErr) {
      // If duplicate in PostgreSQL
      if (dbErr.code === '23505') {
        return res.status(409).json({
          error: 'USERNAME_TAKEN',
          message: 'This username is already taken. Please choose another one.',
        });
      }

      // If database is not configured (e.g. no .env password or table not migrated),
      // seamlessly register into memory store so development remains unblocked
      console.warn('⚠️  PostgreSQL unconfigured or unreachable. Using in-memory store for user:', dbErr.message);

      if (memoryUsers.size >= MAX_USERS) {
        return res.status(403).json({
          error: 'ACCOUNT_LIMIT_REACHED',
          message: `Account limit reached. Only ${MAX_USERS} accounts are allowed.`,
        });
      }

      if (memoryUsers.has(lowerUsername)) {
        return res.status(409).json({
          error: 'USERNAME_TAKEN',
          message: 'This username is already taken. Please choose another one.',
        });
      }

      const memUser = {
        id: `u-${Date.now()}`,
        username: normalizedUsername,
        passwordHash,
        created_at: new Date().toISOString(),
      };
      memoryUsers.set(lowerUsername, memUser);

      const token = generateToken(memUser);

      return res.status(201).json({
        message: 'User registered successfully (dev mode).',
        user: {
          id: memUser.id,
          username: memUser.username,
          created_at: memUser.created_at,
        },
        token,
      });
    }
  } catch (err) {
    console.error('Registration processing error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred during registration.',
    });
  }
});

// ------------------------------------------------------------------------------
// POST /api/auth/login
// ------------------------------------------------------------------------------
router.post('/login', loginRateLimiter, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';

  const generic401 = () =>
    res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
    });

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return generic401();
  }

  const normalizedUsername = username.trim();
  const lowerUsername = normalizedUsername.toLowerCase();
  const configuredAdmin = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.trim().toLowerCase() : '';

  try {
    let user = null;

    // Try finding user in PostgreSQL
    try {
      const { rows } = await pool.query(
        'SELECT id, username, password_hash, is_admin, created_at FROM users WHERE lower(username) = lower($1)',
        [normalizedUsername]
      );
      if (rows.length > 0) {
        user = {
          id: rows[0].id,
          username: rows[0].username,
          passwordHash: rows[0].password_hash,
          isAdmin: Boolean(rows[0].is_admin),
          created_at: rows[0].created_at,
        };
      }
    } catch (dbErr) {
      console.warn('⚠️  PostgreSQL unconfigured or unreachable. Checking in-memory store.');
    }

    // Fallback to in-memory store if not found or DB not available
    // Special auto-seed for standard demo account to ensure it exists in PostgreSQL
    if (!user && lowerUsername === 'demo') {
      try {
        const hash = bcrypt.hashSync('demo1234', 10);
        const { rows } = await pool.query(
          `INSERT INTO users (id, username, password_hash)
           VALUES ('00000000-0000-0000-0000-000000000001', 'demo', $1)
           ON CONFLICT (username) DO UPDATE SET password_hash = $1
           RETURNING id, username, password_hash, created_at`,
          [hash]
        );
        if (rows.length > 0) {
          user = {
            id: rows[0].id,
            username: rows[0].username,
            passwordHash: rows[0].password_hash,
            isAdmin: Boolean(rows[0].is_admin),
            created_at: rows[0].created_at,
          };
        }
      } catch (insertErr) {
        // Fall back to in-memory store
      }
    }

    if (!user && memoryUsers.has(lowerUsername)) {
      user = memoryUsers.get(lowerUsername);
    }

    if (!user) {
      // Timing attack defense: always run dummy bcrypt compare
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      recordLoginFailure(ip, lowerUsername);

      // Audit log failed attempt if submitted username matches ADMIN_USERNAME
      if (configuredAdmin && lowerUsername === configuredAdmin) {
        await writeAuditLog(null, 'admin_login_failure', null, {
          attemptedUsername: normalizedUsername,
          reason: 'unknown_user',
          ip,
        });
      }

      return generic401();
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      recordLoginFailure(ip, lowerUsername);

      // Audit log failed attempt if user is admin or submitted username matches ADMIN_USERNAME
      if (user.isAdmin || (configuredAdmin && lowerUsername === configuredAdmin)) {
        await writeAuditLog(user.id || null, 'admin_login_failure', null, {
          attemptedUsername: normalizedUsername,
          reason: 'invalid_password',
          ip,
        });
      }

      return generic401();
    }

    // Success! Generate regular token
    const token = generateToken(user);
    const responsePayload = {
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        isAdmin: Boolean(user.isAdmin ?? user.is_admin),
        created_at: user.created_at,
      },
      token,
    };

    // If user is admin AND admin config enabled (ADMIN_JWT_SECRET present)
    const adminSecret = process.env.ADMIN_JWT_SECRET;
    if (user.isAdmin && adminSecret) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const authTime = nowSeconds;
      const { idleSeconds, maxSeconds } = getAdminSessionConfig(process.env);
      const sessionEndsSeconds = authTime + maxSeconds;
      const expSeconds = Math.min(nowSeconds + idleSeconds, sessionEndsSeconds);
      const expiresInSeconds = Math.max(1, expSeconds - nowSeconds);

      const adminExpiresAt = new Date(expSeconds * 1000).toISOString();
      const adminSessionEndsAt = new Date(sessionEndsSeconds * 1000).toISOString();

      const adminToken = jwt.sign(
        {
          sub: user.id,
          scope: 'admin',
          auth_time: authTime,
        },
        adminSecret,
        { expiresIn: expiresInSeconds }
      );

      responsePayload.adminToken = adminToken;
      responsePayload.adminExpiresAt = adminExpiresAt;
      responsePayload.adminSessionEndsAt = adminSessionEndsAt;

      await writeAuditLog(user.id, 'admin_login_success', null, {
        username: user.username,
        ip,
      });
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('Login processing error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'An unexpected error occurred during login.',
    });
  }
});

// ------------------------------------------------------------------------------
// GET /api/auth/me (Protected Endpoint)
// ------------------------------------------------------------------------------
router.get('/me', authenticateToken, (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user.id,
      username: req.user.username,
      isAdmin: Boolean(req.user.is_admin),
      created_at: req.user.created_at,
    },
  });
});

export { memoryUsers };
export default router;
