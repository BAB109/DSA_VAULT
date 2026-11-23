import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../../db/pool.js';

const router = express.Router();

/**
 * GET /api/catalog?q=
 * LeetCode Problem Catalog Search Endpoint
 *
 * Query Parameter:
 * - q: Search query string.
 *
 * Requirements:
 * - Requires authentication via authenticateToken.
 * - Empty / missing / whitespace q returns empty array [].
 * - If q consists strictly of digits: exact match on lc_number.
 * - Otherwise: case-insensitive substring match on title, ORDER BY lc_number ASC, LIMIT 20.
 * - Parameterized query only, escaping % and _ in user input before LIKE.
 * - Each item includes computed url: https://leetcode.com/problems/{slug}/
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rawQ = req.query.q;
    if (typeof rawQ !== 'string' || !rawQ.trim()) {
      return res.json([]);
    }

    const q = rawQ.trim();

    // 1. All-digits check: exact match on lc_number
    if (/^\d+$/.test(q)) {
      const lcNumber = parseInt(q, 10);
      const query = `
        SELECT id, lc_number, title, slug, difficulty, topic_tags
        FROM catalog_problems
        WHERE lc_number = $1
        ORDER BY lc_number ASC
      `;
      const { rows } = await pool.query(query, [lcNumber]);
      const results = rows.map((row) => ({
        ...row,
        url: `https://leetcode.com/problems/${row.slug}/`,
      }));
      return res.json(results);
    }

    // 2. Substring match on title (case-insensitive)
    // Escape %, _, and \ so they are matched literally in LIKE pattern
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    const pattern = `%${escaped}%`;

    const query = `
      SELECT id, lc_number, title, slug, difficulty, topic_tags
      FROM catalog_problems
      WHERE LOWER(title) LIKE LOWER($1) ESCAPE '\\'
      ORDER BY lc_number ASC
      LIMIT 20
    `;
    const { rows } = await pool.query(query, [pattern]);
    const results = rows.map((row) => ({
      ...row,
      url: `https://leetcode.com/problems/${row.slug}/`,
    }));
    return res.json(results);
  } catch (err) {
    console.error('Catalog search error:', err.message);
    return res.status(500).json({
      error: 'CATALOG_SEARCH_FAILED',
      message: 'Failed to retrieve catalog questions.',
    });
  }
});

export default router;
