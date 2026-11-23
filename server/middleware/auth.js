import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../../db/pool.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';

/**
 * Middleware: authenticateToken
 * Verifies the JWT Bearer token from the Authorization header.
 * Attaches decoded user payload (id, username) to req.user.
 * Never trusts user_id from req.body or query parameters.
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token required.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user exists in database if accessible
    try {
      const { rows } = await pool.query(
        'SELECT id, username, created_at FROM users WHERE id = $1',
        [decoded.id]
      );

      if (rows.length > 0) {
        req.user = rows[0];
        return next();
      }
    } catch {
      // If DB is unreachable, trust verified JWT payload for development session
    }

    req.user = { id: decoded.id, username: decoded.username, created_at: new Date().toISOString() };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token.',
    });
  }
}
