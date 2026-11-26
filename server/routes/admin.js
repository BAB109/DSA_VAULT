import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { parse } from 'csv-parse/sync';
import { pool } from '../../db/pool.js';
import { getAdminSessionConfig } from '../config/env.js';
import {
  generatePublicCode,
  getTodayInTimezone,
} from './trackers.js';
import {
  fetchTrackerDetails,
  fetchTrackerMembers,
  removeTrackerMember,
  fetchTrackerJoinRequests,
  decideTrackerJoinRequest,
  fetchTrackerInvites,
  createTrackerInvite,
  revokeTrackerInvite,
} from '../services/trackerAdminShared.js';

const router = express.Router();

// ── Audit Log Helper ──────────────────────────────────────────────────────────
export async function writeAuditLog(adminId, action, trackerId, details, client = pool) {
  try {
    await client.query(
      `INSERT INTO admin_audit_log (admin_id, action, tracker_id, details)
       VALUES ($1, $2, $3, $4)`,
      [adminId || null, action, trackerId || null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.warn('⚠️  Could not write admin audit log:', err.message);
  }
}

// ── Require Admin Middleware ──────────────────────────────────────────────────
export async function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Admin authentication required.' });
  }

  const token = authHeader.slice(7).trim();
  const adminSecret = process.env.ADMIN_JWT_SECRET;
  const userSecret = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';

  let adminDecoded = null;
  let adminErr = null;

  if (adminSecret) {
    try {
      adminDecoded = jwt.verify(token, adminSecret);
    } catch (err) {
      adminErr = err;
    }
  }

  if (adminDecoded) {
    if (adminDecoded.scope !== 'admin') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Not found.' });
    }
    const userId = adminDecoded.sub || adminDecoded.id;
    if (!userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Not found.' });
    }
    try {
      const { rows } = await pool.query('SELECT id, username, is_admin FROM users WHERE id = $1', [userId]);
      if (rows.length === 0 || !rows[0].is_admin) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Not found.' });
      }
      req.user = rows[0];
      req.admin = adminDecoded;
      return next();
    } catch (dbErr) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: dbErr.message });
    }
  }

  // Check if it was signed with userSecret (normal user token)
  try {
    const userDecoded = jwt.verify(token, userSecret);
    if (userDecoded) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Not found.' });
    }
  } catch {
    // Not a valid user token
  }

  if (adminErr && adminErr.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Admin session expired. Please log in again.' });
  }

  return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid admin token.' });
}

// Explicit 404 for removed POST /login endpoint (bypass requireAdmin so unauthenticated request returns 404)
router.post('/login', (req, res) => {
  return res.status(404).json({ error: 'NOT_FOUND', message: 'Not found.' });
});

router.use(requireAdmin);

// Rate limiter for refresh endpoint: 30 requests per minute per IP
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many admin session refresh attempts. Please wait a moment.',
  },
});

// ------------------------------------------------------------------------------
// POST /api/admin/refresh
// ------------------------------------------------------------------------------
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const adminSecret = process.env.ADMIN_JWT_SECRET;
    if (!adminSecret) {
      return res.status(401).json({ error: 'ADMIN_DISABLED', message: 'Admin login is not configured.' });
    }

    // requireAdmin verified JWT and checked users.is_admin in DB (req.user and req.admin set)
    // Re-verify is_admin in DB explicitly for extra safety
    const userId = req.user.id;
    const { rows } = await pool.query('SELECT id, username, is_admin FROM users WHERE id = $1', [userId]);
    if (rows.length === 0 || !rows[0].is_admin) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User is not an active admin.' });
    }

    const { idleSeconds, maxSeconds } = getAdminSessionConfig(process.env);
    const nowSeconds = Math.floor(Date.now() / 1000);

    // auth_time preservation
    const authTime = Number(req.admin?.auth_time || req.admin?.iat || nowSeconds);
    const sessionEndsSeconds = authTime + maxSeconds;

    // Check if hard cap reached: reject with 401 if now - auth_time >= max
    if (nowSeconds - authTime >= maxSeconds || nowSeconds >= sessionEndsSeconds) {
      return res.status(401).json({
        error: 'SESSION_CAP_REACHED',
        message: 'Maximum admin session length reached. Please sign in again.',
      });
    }

    const expSeconds = Math.min(nowSeconds + idleSeconds, sessionEndsSeconds);
    const expiresInSeconds = expSeconds - nowSeconds;

    if (expiresInSeconds <= 0) {
      return res.status(401).json({
        error: 'SESSION_CAP_REACHED',
        message: 'Maximum admin session length reached. Please sign in again.',
      });
    }

    const newAdminToken = jwt.sign(
      {
        sub: userId,
        scope: 'admin',
        auth_time: authTime,
      },
      adminSecret,
      { expiresIn: expiresInSeconds }
    );

    const expiresAt = new Date(expSeconds * 1000).toISOString();
    const sessionEndsAt = new Date(sessionEndsSeconds * 1000).toISOString();

    return res.status(200).json({
      adminToken: newAdminToken,
      expiresAt,
      sessionEndsAt,
    });
  } catch (err) {
    console.error('Admin session refresh error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to refresh admin session.' });
  }
});

function isValidUUID(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function validateTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ── CSV Parsing & Validation Helper ───────────────────────────────────────────
function parseCsvRows(csv) {
  if (!csv || typeof csv !== 'string') {
    throw { status: 400, error: 'INVALID_CSV', message: 'CSV string is required.' };
  }
  if (Buffer.byteLength(csv, 'utf8') > 1024 * 1024) {
    throw { status: 400, error: 'FILE_TOO_LARGE', message: 'CSV exceeds 1MB limit.' };
  }
  let rows;
  try {
    rows = parse(csv, { skip_empty_lines: true, trim: true });
  } catch (err) {
    throw { status: 400, error: 'PARSE_ERROR', message: err.message };
  }
  if (rows.length === 0) {
    throw { status: 400, error: 'EMPTY_CSV', message: 'CSV is empty.' };
  }
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const lcIndex = headers.indexOf('lc_number');
  if (lcIndex === -1) {
    throw { status: 400, error: 'MISSING_COLUMN', message: 'Missing lc_number column in CSV.' };
  }
  const posIndex = headers.indexOf('position');
  const dataRows = rows.slice(1);
  if (dataRows.length > 1000) {
    throw { status: 400, error: 'TOO_MANY_ROWS', message: 'CSV exceeds 1000 rows limit.' };
  }

  const seen = new Set();
  const duplicates = [];
  const uniqueItems = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lcNum = parseInt(row[lcIndex]?.trim(), 10);
    if (isNaN(lcNum) || lcNum <= 0) continue;
    const pos = posIndex !== -1 && row[posIndex]?.trim() ? parseInt(row[posIndex].trim(), 10) : i + 1;

    if (seen.has(lcNum)) {
      if (!duplicates.includes(lcNum)) {
        duplicates.push(lcNum);
      }
    } else {
      seen.add(lcNum);
      uniqueItems.push({ lc_number: lcNum, position: pos });
    }
  }

  return { uniqueItems, duplicates };
}

// ── GET /api/admin/trackers ───────────────────────────────────────────────────
router.get('/trackers', async (req, res) => {
  try {
    const { rows: trackers } = await pool.query(
      `SELECT t.*, u.username AS creator_username
       FROM trackers t
       LEFT JOIN users u ON u.id = t.created_by
       ORDER BY t.created_at DESC`
    );

    const results = await Promise.all(
      trackers.map(async (t) => {
        const trackerId = t.id;
        const timezone = t.timezone || 'Asia/Kolkata';
        const todayStr = getTodayInTimezone(timezone);

        // 1. Member count & member list for pending calculation
        const { rows: members } = await pool.query(
          `SELECT user_id, joined_at FROM tracker_members WHERE tracker_id = $1`,
          [trackerId]
        );
        const memberCount = members.length;

        // 2. Sheet summary (total items vs assigned items)
        const { rows: sheetRows } = await pool.query(
          `SELECT COUNT(*)::int AS total FROM tracker_sheet_items WHERE tracker_id = $1`,
          [trackerId]
        );
        const total = sheetRows[0]?.total || 0;

        const { rows: assignedRows } = await pool.query(
          `SELECT COUNT(DISTINCT catalog_id)::int AS assigned FROM tracker_assignments WHERE tracker_id = $1`,
          [trackerId]
        );
        const assigned = assignedRows[0]?.assigned || 0;
        const remaining = Math.max(0, total - assigned);
        const perDay = t.per_day || 2;
        const estimatedDaysLeft = perDay > 0 ? Math.ceil(remaining / perDay) : 0;

        // 3. Today progress (done vs expected)
        const { rows: todayAssignments } = await pool.query(
          `SELECT id FROM tracker_assignments WHERE tracker_id = $1 AND assign_date = $2`,
          [trackerId, todayStr]
        );
        const todayAssignmentCount = todayAssignments.length;
        const expected = todayAssignmentCount * memberCount;

        let done = 0;
        if (todayAssignmentCount > 0 && memberCount > 0) {
          const { rows: subRows } = await pool.query(
            `SELECT COUNT(DISTINCT s.id)::int AS count
             FROM submissions s
             JOIN tracker_assignments a ON a.id = s.assignment_id
             WHERE a.tracker_id = $1 AND a.assign_date = $2`,
            [trackerId, todayStr]
          );
          done = subRows[0]?.count || 0;
        }

        // 4. Pending total across all members (unsubmitted assignments where assign_date < todayStr)
        let pendingTotal = 0;
        if (memberCount > 0) {
          const { rows: pendingRows } = await pool.query(
            `SELECT m.user_id, a.id AS assignment_id
             FROM tracker_members m
             JOIN tracker_assignments a ON a.tracker_id = m.tracker_id
             LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = m.user_id
             WHERE m.tracker_id = $1
               AND a.assign_date < $2
               AND a.assign_date >= (m.joined_at AT TIME ZONE $3)::date
               AND s.id IS NULL`,
            [trackerId, todayStr, timezone]
          );
          pendingTotal = pendingRows.length;
        }

        return {
          id: t.id,
          name: t.name,
          public_code: t.public_code,
          publicCode: t.public_code,
          status: t.status || 'active',
          timezone: t.timezone,
          per_day: t.per_day,
          perDay: t.per_day,
          start_date: t.start_date,
          startDate: t.start_date,
          created_at: t.created_at,
          member_count: memberCount,
          memberCount,
          sheet: {
            total,
            assigned,
            remaining,
            estimatedDaysLeft,
          },
          today: {
            done,
            expected,
          },
          pendingTotal,
        };
      })
    );

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── POST /api/admin/trackers ──────────────────────────────────────────────────
router.post('/trackers', async (req, res) => {
  const { name, timezone, per_day, start_date, csv, initialCsv } = req.body || {};
  const csvContent = csv || initialCsv;
  const adminId = req.user.id;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'INVALID_NAME', message: 'Name is required.' });
  }
  if (!validateTimezone(timezone)) {
    return res.status(400).json({ error: 'INVALID_TIMEZONE', message: 'Valid IANA timezone required.' });
  }

  const perDayInt = parseInt(per_day, 10);
  if (isNaN(perDayInt) || perDayInt < 1 || perDayInt > 10) {
    return res.status(400).json({ error: 'INVALID_PER_DAY', message: 'per_day must be between 1 and 10.' });
  }

  const startDate = start_date && /^\d{4}-\d{2}-\d{2}$/.test(start_date)
    ? start_date
    : getTodayInTimezone(timezone);

  let initialItems = [];
  if (csvContent) {
    try {
      const { uniqueItems } = parseCsvRows(csvContent);
      const lcNums = uniqueItems.map((u) => u.lc_number);
      if (lcNums.length > 0) {
        const { rows: dbProblems } = await pool.query(
          'SELECT id, lc_number, title FROM catalog_problems WHERE lc_number = ANY($1)',
          [lcNums]
        );
        const foundMap = new Map(dbProblems.map((p) => [p.lc_number, p]));
        const unknown = [];
        for (const item of uniqueItems) {
          const p = foundMap.get(item.lc_number);
          if (p) {
            initialItems.push({ catalog_id: p.id, position: item.position });
          } else {
            unknown.push(item.lc_number);
          }
        }
        if (unknown.length > 0) {
          return res.status(400).json({
            error: 'UNKNOWN_PROBLEMS',
            message: 'CSV contains unknown LeetCode numbers.',
            unknown,
          });
        }
      }
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.error || 'INVALID_CSV', message: err.message });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate unique public_code
    let publicCode;
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = generatePublicCode();
      const existing = await client.query('SELECT 1 FROM trackers WHERE public_code = $1', [candidate]);
      if (existing.rows.length === 0) {
        publicCode = candidate;
        break;
      }
    }
    if (!publicCode) {
      throw new Error('Failed to generate unique public code.');
    }

    const { rows: trackerRows } = await client.query(
      `INSERT INTO trackers (name, public_code, timezone, per_day, start_date, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [name.trim(), publicCode, timezone, perDayInt, startDate, adminId]
    );
    const newTracker = trackerRows[0];

    // Insert sheet items if provided
    if (initialItems.length > 0) {
      for (const item of initialItems) {
        await client.query(
          `INSERT INTO tracker_sheet_items (tracker_id, catalog_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (tracker_id, catalog_id) DO UPDATE SET position = EXCLUDED.position`,
          [newTracker.id, item.catalog_id, item.position]
        );
      }
    }

    await writeAuditLog(adminId, 'create_tracker', newTracker.id, {
      name: newTracker.name,
      timezone,
      per_day: perDayInt,
      start_date: startDate,
      public_code: publicCode,
      initial_sheet_count: initialItems.length,
    }, client);

    await client.query('COMMIT');

    return res.status(201).json({
      ...newTracker,
      publicCode: newTracker.public_code,
      perDay: newTracker.per_day,
      startDate: newTracker.start_date,
      sheetItemsImported: initialItems.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── GET /api/admin/trackers/:id ───────────────────────────────────────────────
router.get('/trackers/:id', async (req, res) => {
  const { id: trackerId } = req.params;
  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const tracker = await fetchTrackerDetails(trackerId);
  if (!tracker) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  return res.status(200).json(tracker);
});

// ── GET /api/admin/trackers/:id/members ───────────────────────────────────────
router.get('/trackers/:id/members', async (req, res) => {
  const { id: trackerId } = req.params;
  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const { rows: tCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
  if (tCheck.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const members = await fetchTrackerMembers(trackerId);
  return res.status(200).json(members);
});

// ── POST /api/admin/trackers/:id/members/:userId/remove ───────────────────────
router.post('/trackers/:id/members/:userId/remove', async (req, res) => {
  const { id: trackerId, userId: targetUserId } = req.params;
  const adminId = req.user.id;

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const { rows: tCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
  if (tCheck.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const removed = await removeTrackerMember(trackerId, targetUserId);
  if (!removed) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Member not found in tracker.' });
  }

  await writeAuditLog(adminId, 'remove_member', trackerId, {
    removedUserId: targetUserId,
  });

  return res.status(200).json({ message: 'Member removed.' });
});

// ── GET /api/admin/trackers/:id/requests ──────────────────────────────────────
router.get('/trackers/:id/requests', async (req, res) => {
  const { id: trackerId } = req.params;
  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const { rows: tCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
  if (tCheck.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const rows = await fetchTrackerJoinRequests(trackerId);
  return res.status(200).json(rows);
});

// ── POST /api/admin/trackers/:id/requests/:reqId/decision ─────────────────────
router.post('/trackers/:id/requests/:reqId/decision', async (req, res) => {
  const { id: trackerId, reqId } = req.params;
  const adminId = req.user.id;
  const decision = (req.body?.decision || req.body?.action || '').toLowerCase();

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const { rows: tCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
  if (tCheck.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ error: 'INVALID_DECISION', message: 'Decision must be approve or reject.' });
  }

  const result = await decideTrackerJoinRequest(trackerId, reqId, decision, adminId);
  if (result.notFound) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Join request not found.' });
  }
  if (result.alreadyDecided) {
    return res.status(409).json({ error: 'ALREADY_DECIDED', message: `Request is already ${result.status}.` });
  }

  await writeAuditLog(adminId, 'decide_join_request', trackerId, {
    requestId: reqId,
    decision,
  });

  return res.status(200).json({ success: true, status: result.status });
});

// ── GET /api/admin/trackers/:id/invites ───────────────────────────────────────
router.get('/trackers/:id/invites', async (req, res) => {
  const { id: trackerId } = req.params;
  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const { rows: tCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
  if (tCheck.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const invites = await fetchTrackerInvites(trackerId);
  return res.status(200).json(invites);
});

// ── POST /api/admin/trackers/:id/invites ──────────────────────────────────────
router.post('/trackers/:id/invites', async (req, res) => {
  const { id: trackerId } = req.params;
  const adminId = req.user.id;
  const { expiresInDays = 7, maxUses = 10 } = req.body || {};
  const expDays = parseInt(expiresInDays, 10) || 7;
  const uses = parseInt(maxUses, 10) || 10;

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const { rows: tCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
  if (tCheck.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const invite = await createTrackerInvite(trackerId, adminId, expDays, uses);

  await writeAuditLog(adminId, 'create_invite', trackerId, {
    inviteId: invite.id,
    expiresInDays: expDays,
    maxUses: uses,
  });

  return res.status(201).json({
    message: 'Invite created successfully.',
    invite,
  });
});

// ── DELETE /api/admin/trackers/:id/invites/:inviteId ──────────────────────────
router.delete('/trackers/:id/invites/:inviteId', async (req, res) => {
  const { id: trackerId, inviteId } = req.params;
  const adminId = req.user.id;

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const { rows: tCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
  if (tCheck.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const revoked = await revokeTrackerInvite(trackerId, inviteId);
  if (!revoked) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Invite not found or already revoked.' });
  }

  await writeAuditLog(adminId, 'revoke_invite', trackerId, {
    inviteId,
  });

  return res.status(200).json({ message: 'Invite revoked.' });
});

// ── GET /api/admin/catalog ────────────────────────────────────────────────────
router.get('/catalog', async (req, res) => {
  try {
    const rawQ = req.query.q;
    if (typeof rawQ !== 'string' || !rawQ.trim()) {
      return res.json([]);
    }

    const q = rawQ.trim();

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
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── PATCH /api/admin/trackers/:id ─────────────────────────────────────────────
router.patch('/trackers/:id', async (req, res) => {
  const { id: trackerId } = req.params;
  const adminId = req.user.id;
  const { name, timezone, per_day, status, applyToday } = req.body || {};

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: tRows } = await client.query(
      'SELECT * FROM trackers WHERE id = $1 FOR UPDATE',
      [trackerId]
    );
    if (tRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }
    const current = tRows[0];

    // Validate updates
    let updatedName = current.name;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INVALID_NAME', message: 'Name cannot be empty.' });
      }
      updatedName = name.trim();
    }

    let updatedTz = current.timezone;
    if (timezone !== undefined) {
      if (!validateTimezone(timezone)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INVALID_TIMEZONE', message: 'Invalid IANA timezone.' });
      }
      updatedTz = timezone;
    }

    let updatedStatus = current.status || 'active';
    if (status !== undefined) {
      if (status !== 'active' && status !== 'archived') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be active or archived.' });
      }
      updatedStatus = status;
    }

    let updatedPerDay = current.per_day;
    if (per_day !== undefined) {
      const p = parseInt(per_day, 10);
      if (isNaN(p) || p < 1 || p > 10) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INVALID_PER_DAY', message: 'per_day must be between 1 and 10.' });
      }
      updatedPerDay = p;

      // Handle applyToday
      if (applyToday === true) {
        const todayStr = getTodayInTimezone(updatedTz);
        const { rows: todayRows } = await client.query(
          'SELECT COUNT(*)::int AS count FROM tracker_assignments WHERE tracker_id = $1 AND assign_date = $2',
          [trackerId, todayStr]
        );
        const currentTodayCount = todayRows[0]?.count || 0;

        if (updatedPerDay < currentTodayCount) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'CANNOT_REDUCE_TODAY',
            message: `applyToday may only increase today's count. Today already has ${currentTodayCount} assignments.`,
          });
        }

        if (updatedPerDay > currentTodayCount) {
          const needed = updatedPerDay - currentTodayCount;
          // Fetch needed unassigned sheet items
          const { rows: unassigned } = await client.query(
            `SELECT s.catalog_id FROM tracker_sheet_items s
             WHERE s.tracker_id = $1
               AND s.catalog_id NOT IN (
                 SELECT a.catalog_id FROM tracker_assignments a WHERE a.tracker_id = $1
               )
             ORDER BY s.position ASC
             LIMIT $2`,
            [trackerId, needed]
          );

          for (const item of unassigned) {
            await client.query(
              `INSERT INTO tracker_assignments (tracker_id, assign_date, catalog_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (tracker_id, assign_date, catalog_id) DO NOTHING`,
              [trackerId, todayStr, item.catalog_id]
            );
          }
        }
      }
    }

    const { rows: updatedRows } = await client.query(
      `UPDATE trackers
       SET name = $1, timezone = $2, per_day = $3, status = $4
       WHERE id = $5
       RETURNING *`,
      [updatedName, updatedTz, updatedPerDay, updatedStatus, trackerId]
    );
    const updated = updatedRows[0];

    await writeAuditLog(adminId, 'update_tracker', trackerId, {
      previous: {
        name: current.name,
        timezone: current.timezone,
        per_day: current.per_day,
        status: current.status,
      },
      updated: {
        name: updated.name,
        timezone: updated.timezone,
        per_day: updated.per_day,
        status: updated.status,
        applyToday: Boolean(applyToday),
      },
    }, client);

    await client.query('COMMIT');
    return res.status(200).json({
      ...updated,
      publicCode: updated.public_code,
      perDay: updated.per_day,
      startDate: updated.start_date,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── GET /api/admin/trackers/:id/sheet ──────────────────────────────────────────
router.get('/trackers/:id/sheet', async (req, res) => {
  const { id: trackerId } = req.params;
  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  try {
    const { rows: trackerCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
    if (trackerCheck.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }

    const { rows } = await pool.query(
      `SELECT 
         s.position,
         s.catalog_id,
         c.lc_number,
         c.title,
         c.difficulty,
         c.slug,
         a.assign_date::text AS assigned_date,
         CASE WHEN a.catalog_id IS NOT NULL THEN 'assigned' ELSE 'upcoming' END AS state
       FROM tracker_sheet_items s
       JOIN catalog_problems c ON c.id = s.catalog_id
       LEFT JOIN tracker_assignments a ON a.tracker_id = s.tracker_id AND a.catalog_id = s.catalog_id
       WHERE s.tracker_id = $1
       ORDER BY s.position ASC`,
      [trackerId]
    );

    const items = rows.map((r) => ({
      position: r.position,
      catalogId: r.catalog_id,
      catalog_id: r.catalog_id,
      lcNumber: r.lc_number,
      lc_number: r.lc_number,
      title: r.title,
      difficulty: r.difficulty,
      slug: r.slug,
      state: r.state,
      assignedDate: r.assigned_date,
      assigned_date: r.assigned_date,
    }));

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// ── POST /api/admin/trackers/:id/sheet/preview ────────────────────────────────
router.post('/trackers/:id/sheet/preview', async (req, res) => {
  const { id: trackerId } = req.params;
  const { csv, mode = 'replace' } = req.body || {};

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }
  if (mode !== 'replace' && mode !== 'append') {
    return res.status(400).json({ error: 'INVALID_MODE', message: 'Mode must be replace or append.' });
  }

  try {
    const { rows: trackerCheck } = await pool.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
    if (trackerCheck.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }

    const { uniqueItems, duplicates } = parseCsvRows(csv);
    const lcNums = uniqueItems.map((u) => u.lc_number);

    let dbProblems = [];
    if (lcNums.length > 0) {
      const dbRes = await pool.query(
        'SELECT id, lc_number, title FROM catalog_problems WHERE lc_number = ANY($1)',
        [lcNums]
      );
      dbProblems = dbRes.rows;
    }

    const foundMap = new Map(dbProblems.map((p) => [p.lc_number, p]));
    const unknown = [];
    const validItems = [];

    for (const item of uniqueItems) {
      const p = foundMap.get(item.lc_number);
      if (p) {
        validItems.push({
          catalog_id: p.id,
          lc_number: item.lc_number,
          title: p.title,
          position: item.position,
        });
      } else {
        unknown.push(item.lc_number);
      }
    }

    // Check existing sheet numbers
    const { rows: existingSheetRows } = await pool.query(
      `SELECT c.lc_number
       FROM tracker_sheet_items s
       JOIN catalog_problems c ON c.id = s.catalog_id
       WHERE s.tracker_id = $1`,
      [trackerId]
    );
    const existingSet = new Set(existingSheetRows.map((r) => r.lc_number));

    const alreadyInSheet = [];
    const itemsToApply = [];

    for (const item of validItems) {
      if (mode === 'append' && existingSet.has(item.lc_number)) {
        alreadyInSheet.push(item.lc_number);
      } else {
        itemsToApply.push(item);
      }
    }

    return res.status(200).json({
      valid: itemsToApply.length,
      unknown,
      duplicates,
      alreadyInSheet,
      mode,
      firstTen: itemsToApply.slice(0, 10).map((v) => ({ lc_number: v.lc_number, title: v.title })),
    });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.error || 'INVALID_CSV', message: err.message });
  }
});

// ── POST /api/admin/trackers/:id/sheet/confirm ────────────────────────────────
router.post('/trackers/:id/sheet/confirm', async (req, res) => {
  const { id: trackerId } = req.params;
  const adminId = req.user.id;
  const { csv, mode = 'replace' } = req.body || {};

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }
  if (mode !== 'replace' && mode !== 'append') {
    return res.status(400).json({ error: 'INVALID_MODE', message: 'Mode must be replace or append.' });
  }

  let uniqueItems;
  try {
    const parsed = parseCsvRows(csv);
    uniqueItems = parsed.uniqueItems;
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.error || 'INVALID_CSV', message: err.message });
  }

  const lcNums = uniqueItems.map((u) => u.lc_number);
  let dbProblems = [];
  if (lcNums.length > 0) {
    const dbRes = await pool.query(
      'SELECT id, lc_number, title FROM catalog_problems WHERE lc_number = ANY($1)',
      [lcNums]
    );
    dbProblems = dbRes.rows;
  }

  const foundMap = new Map(dbProblems.map((p) => [p.lc_number, p]));
  const unknown = [];
  const validItems = [];

  for (const item of uniqueItems) {
    const p = foundMap.get(item.lc_number);
    if (p) {
      validItems.push({
        catalog_id: p.id,
        lc_number: item.lc_number,
        position: item.position,
      });
    } else {
      unknown.push(item.lc_number);
    }
  }

  if (unknown.length > 0) {
    return res.status(400).json({
      error: 'UNKNOWN_PROBLEMS',
      message: 'Sheet contains unknown LeetCode numbers.',
      unknown,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: trackerCheck } = await client.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
    if (trackerCheck.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }

    let addedCount = 0;
    let skippedCount = 0;

    if (mode === 'replace') {
      // 1. Delete only unassigned items
      await client.query(
        `DELETE FROM tracker_sheet_items
         WHERE tracker_id = $1
           AND catalog_id NOT IN (
             SELECT catalog_id FROM tracker_assignments WHERE tracker_id = $1
           )`,
        [trackerId]
      );

      // 2. Fetch assigned items catalog_ids (they must stay intact)
      const { rows: assignedRows } = await client.query(
        'SELECT catalog_id FROM tracker_assignments WHERE tracker_id = $1',
        [trackerId]
      );
      const assignedSet = new Set(assignedRows.map((r) => r.catalog_id));

      // 3. Find max position of remaining (assigned) items
      const { rows: maxPosRow } = await client.query(
        'SELECT COALESCE(MAX(position), 0) AS max_pos FROM tracker_sheet_items WHERE tracker_id = $1',
        [trackerId]
      );
      let currentPos = maxPosRow[0]?.max_pos || 0;

      // 4. Insert new items sequentially, skipping any already assigned
      for (const item of validItems) {
        if (assignedSet.has(item.catalog_id)) {
          skippedCount++;
          continue;
        }
        currentPos++;
        await client.query(
          `INSERT INTO tracker_sheet_items (tracker_id, catalog_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (tracker_id, catalog_id) DO UPDATE SET position = EXCLUDED.position`,
          [trackerId, item.catalog_id, currentPos]
        );
        addedCount++;
      }
    } else {
      // mode === 'append'
      // 1. Fetch all existing items in sheet
      const { rows: existingRows } = await client.query(
        'SELECT catalog_id FROM tracker_sheet_items WHERE tracker_id = $1',
        [trackerId]
      );
      const existingSet = new Set(existingRows.map((r) => r.catalog_id));

      // 2. Find max position
      const { rows: maxPosRow } = await client.query(
        'SELECT COALESCE(MAX(position), 0) AS max_pos FROM tracker_sheet_items WHERE tracker_id = $1',
        [trackerId]
      );
      let currentPos = maxPosRow[0]?.max_pos || 0;

      // 3. Append only items not already in the sheet
      for (const item of validItems) {
        if (existingSet.has(item.catalog_id)) {
          skippedCount++;
          continue;
        }
        currentPos++;
        await client.query(
          `INSERT INTO tracker_sheet_items (tracker_id, catalog_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (tracker_id, catalog_id) DO NOTHING`,
          [trackerId, item.catalog_id, currentPos]
        );
        existingSet.add(item.catalog_id);
        addedCount++;
      }
    }

    await writeAuditLog(adminId, 'sheet_confirm', trackerId, {
      mode,
      addedCount,
      skippedCount,
      totalValidInCsv: validItems.length,
    }, client);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, addedCount, skippedCount, mode });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/trackers/:id/sheet/items ──────────────────────────────────
router.post('/trackers/:id/sheet/items', async (req, res) => {
  const { id: trackerId } = req.params;
  const adminId = req.user.id;
  const { lc_number, lcNumber, catalogId, catalog_id, position } = req.body || {};

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: trackerCheck } = await client.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
    if (trackerCheck.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }

    let catItem;
    if (catalogId !== undefined || catalog_id !== undefined) {
      const cId = parseInt(catalogId ?? catalog_id, 10);
      if (isNaN(cId) || cId <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INVALID_CATALOG_ID', message: 'Valid catalogId required.' });
      }
      const { rows } = await client.query(
        'SELECT id, lc_number, title, slug, difficulty FROM catalog_problems WHERE id = $1',
        [cId]
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'CATALOG_NOT_FOUND', message: `Catalog item ${cId} not found.` });
      }
      catItem = rows[0];
    } else {
      const targetLcNumber = lc_number ?? lcNumber;
      const lcInt = parseInt(targetLcNumber, 10);
      if (isNaN(lcInt) || lcInt <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'INVALID_LC_NUMBER', message: 'Positive integer lc_number or catalogId required.' });
      }
      const { rows } = await client.query(
        'SELECT id, lc_number, title, slug, difficulty FROM catalog_problems WHERE lc_number = $1',
        [lcInt]
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'CATALOG_NOT_FOUND', message: `Problem #${lcInt} not found in catalog.` });
      }
      catItem = rows[0];
    }

    // Check if already in sheet
    const { rows: dupCheck } = await client.query(
      'SELECT 1 FROM tracker_sheet_items WHERE tracker_id = $1 AND catalog_id = $2',
      [trackerId, catItem.id]
    );
    if (dupCheck.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'DUPLICATE_ITEM', message: `Problem #${catItem.lc_number} already in sheet.` });
    }

    let insertPos;
    if (position !== undefined && !isNaN(parseInt(position, 10))) {
      insertPos = parseInt(position, 10);
    } else {
      const { rows: maxPosRow } = await client.query(
        'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM tracker_sheet_items WHERE tracker_id = $1',
        [trackerId]
      );
      insertPos = maxPosRow[0]?.next_pos || 1;
    }

    await client.query(
      `INSERT INTO tracker_sheet_items (tracker_id, catalog_id, position)
       VALUES ($1, $2, $3)`,
      [trackerId, catItem.id, insertPos]
    );

    await writeAuditLog(adminId, 'add_sheet_item', trackerId, {
      catalog_id: catItem.id,
      lc_number: catItem.lc_number,
      position: insertPos,
      title: catItem.title,
    }, client);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      item: {
        catalogId: catItem.id,
        catalog_id: catItem.id,
        lcNumber: catItem.lc_number,
        lc_number: catItem.lc_number,
        title: catItem.title,
        slug: catItem.slug,
        difficulty: catItem.difficulty,
        position: insertPos,
        state: 'upcoming',
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/admin/trackers/:id/sheet/items/:catalogId ──────────────────────
router.delete('/trackers/:id/sheet/items/:catalogId', async (req, res) => {
  const { id: trackerId, catalogId } = req.params;
  const adminId = req.user.id;

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }
  const catIdInt = parseInt(catalogId, 10);
  if (isNaN(catIdInt)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid catalogId.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if item exists in sheet
    const { rows: sheetCheck } = await client.query(
      'SELECT position FROM tracker_sheet_items WHERE tracker_id = $1 AND catalog_id = $2',
      [trackerId, catIdInt]
    );
    if (sheetCheck.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Item not in sheet.' });
    }

    // Check if item is already assigned
    const { rows: assignCheck } = await client.query(
      'SELECT 1 FROM tracker_assignments WHERE tracker_id = $1 AND catalog_id = $2',
      [trackerId, catIdInt]
    );
    if (assignCheck.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'CANNOT_DELETE_ASSIGNED',
        message: 'Cannot delete an assigned item from the sheet.',
      });
    }

    await client.query(
      'DELETE FROM tracker_sheet_items WHERE tracker_id = $1 AND catalog_id = $2',
      [trackerId, catIdInt]
    );

    await writeAuditLog(adminId, 'delete_sheet_item', trackerId, {
      catalog_id: catIdInt,
    }, client);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Item removed from sheet.' });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/admin/trackers/:id/sheet/order ───────────────────────────────────
router.put('/trackers/:id/sheet/order', async (req, res) => {
  const { id: trackerId } = req.params;
  const adminId = req.user.id;

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const orderList = Array.isArray(req.body)
    ? req.body
    : (req.body?.order || req.body?.upcomingCatalogIds || req.body?.catalogIds);

  if (!Array.isArray(orderList)) {
    return res.status(400).json({ error: 'INVALID_ORDER', message: 'Array of upcoming catalog IDs required.' });
  }

  const targetIds = orderList.map((id) => parseInt(id, 10));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch current upcoming items
    const { rows: upcomingRows } = await client.query(
      `SELECT s.catalog_id
       FROM tracker_sheet_items s
       WHERE s.tracker_id = $1
         AND s.catalog_id NOT IN (
           SELECT a.catalog_id FROM tracker_assignments a WHERE a.tracker_id = $1
         )
       ORDER BY s.position ASC`,
      [trackerId]
    );

    const upcomingSet = new Set(upcomingRows.map((r) => r.catalog_id));

    // Reject if targetIds does not exactly match the current upcoming set
    if (targetIds.length !== upcomingSet.size) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'INVALID_ORDER',
        message: 'Order list length must exactly match the number of upcoming items.',
      });
    }

    for (const id of targetIds) {
      if (!upcomingSet.has(id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'INVALID_ORDER',
          message: `ID ${id} is not part of the upcoming set.`,
        });
      }
    }

    // Find max position among assigned items
    const { rows: maxAssignedRow } = await client.query(
      `SELECT COALESCE(MAX(s.position), 0) AS max_pos
       FROM tracker_sheet_items s
       JOIN tracker_assignments a ON a.tracker_id = s.tracker_id AND a.catalog_id = s.catalog_id
       WHERE s.tracker_id = $1`,
      [trackerId]
    );
    const maxAssignedPos = maxAssignedRow[0]?.max_pos || 0;

    // Update positions sequentially starting after maxAssignedPos
    for (let i = 0; i < targetIds.length; i++) {
      const newPos = maxAssignedPos + 1 + i;
      await client.query(
        'UPDATE tracker_sheet_items SET position = $1 WHERE tracker_id = $2 AND catalog_id = $3',
        [newPos, trackerId, targetIds[i]]
      );
    }

    await writeAuditLog(adminId, 'reorder_sheet', trackerId, {
      new_order: targetIds,
    }, client);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, count: targetIds.length });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/trackers/:id/sheet/clear-upcoming ─────────────────────────
router.post('/trackers/:id/sheet/clear-upcoming', async (req, res) => {
  const { id: trackerId } = req.params;
  const adminId = req.user.id;

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: trackerCheck } = await client.query('SELECT id FROM trackers WHERE id = $1', [trackerId]);
    if (trackerCheck.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }

    const { rowCount } = await client.query(
      `DELETE FROM tracker_sheet_items
       WHERE tracker_id = $1
         AND catalog_id NOT IN (
           SELECT a.catalog_id FROM tracker_assignments a WHERE a.tracker_id = $1
         )`,
      [trackerId]
    );

    await writeAuditLog(adminId, 'clear_upcoming', trackerId, {
      removed_count: rowCount,
    }, client);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, removedCount: rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/admin/trackers/:id ────────────────────────────────────────────
router.delete('/trackers/:id', async (req, res) => {
  const { id: trackerId } = req.params;
  const adminId = req.user.id;
  const { confirmName } = req.body || {};

  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: tRows } = await client.query(
      'SELECT id, name FROM trackers WHERE id = $1 FOR UPDATE',
      [trackerId]
    );
    if (tRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }
    const tracker = tRows[0];

    if (confirmName !== tracker.name) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'NAME_MISMATCH',
        message: 'Confirmation name does not match tracker name.',
      });
    }

    // Cascade deletion of tracker tables (never deletes problems in vaults)
    // 1. Submissions for this tracker's assignments
    await client.query(
      `DELETE FROM submissions WHERE assignment_id IN (
         SELECT id FROM tracker_assignments WHERE tracker_id = $1
       )`,
      [trackerId]
    );
    // 2. Assignments
    await client.query('DELETE FROM tracker_assignments WHERE tracker_id = $1', [trackerId]);
    // 3. Sheet items
    await client.query('DELETE FROM tracker_sheet_items WHERE tracker_id = $1', [trackerId]);
    // 4. Join requests
    await client.query('DELETE FROM tracker_join_requests WHERE tracker_id = $1', [trackerId]);
    // 5. Invites
    await client.query('DELETE FROM tracker_invites WHERE tracker_id = $1', [trackerId]);
    // 6. Members
    await client.query('DELETE FROM tracker_members WHERE tracker_id = $1', [trackerId]);
    // 7. Tracker
    await client.query('DELETE FROM trackers WHERE id = $1', [trackerId]);

    // Audit log survives because admin_audit_log has no FK on tracker_id!
    await writeAuditLog(adminId, 'delete_tracker', trackerId, {
      deleted_tracker_name: tracker.name,
      trackerName: tracker.name,
      hard_delete: true,
    }, client);

    await client.query('COMMIT');
    return res.status(200).json({ success: true, message: 'Tracker permanently deleted.' });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  } finally {
    client.release();
  }
});

// ── GET /api/admin/audit ──────────────────────────────────────────────────────
router.get('/audit', async (req, res) => {
  const { trackerId, limit = 50 } = req.query;

  const limitInt = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  let query = `
    SELECT 
      l.id,
      l.admin_id,
      u.username AS admin_username,
      l.action,
      l.tracker_id,
      t.name AS tracker_name,
      l.details,
      l.created_at
    FROM admin_audit_log l
    JOIN users u ON u.id = l.admin_id
    LEFT JOIN trackers t ON t.id = l.tracker_id
  `;
  const params = [];

  if (trackerId && isValidUUID(trackerId)) {
    params.push(trackerId);
    query += ` WHERE l.tracker_id = $${params.length}`;
  }

  params.push(limitInt);
  query += ` ORDER BY l.created_at DESC LIMIT $${params.length}`;

  try {
    const { rows } = await pool.query(query, params);
    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
