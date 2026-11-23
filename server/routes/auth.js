import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { pool } from '../../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 12;

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

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
    });
  }

  const normalizedUsername = username.trim();
  const lowerUsername = normalizedUsername.toLowerCase();

  try {
    let user = null;

    // Try finding user in PostgreSQL
    try {
      const { rows } = await pool.query(
        'SELECT id, username, password_hash, created_at FROM users WHERE username = $1',
        [normalizedUsername]
      );
      if (rows.length > 0) {
        user = {
          id: rows[0].id,
          username: rows[0].username,
          passwordHash: rows[0].password_hash,
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
      // Thwart timing attacks
      await bcrypt.compare(
        password,
        '$2b$12$e8Y5M54M9420tYnC2gJq3e4M54M9420tYnC2gJq3e4M54M9420tYn'
      );
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      },
      token,
    });
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
      created_at: req.user.created_at,
    },
  });
});

export { memoryUsers };
export default router;
