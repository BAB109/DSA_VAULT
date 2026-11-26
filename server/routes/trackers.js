import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { parse } from 'csv-parse/sync';
import { pool } from '../../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from './admin.js';
import {
  fetchTrackerJoinRequests,
  decideTrackerJoinRequest,
  fetchTrackerInvites,
  createTrackerInvite,
  revokeTrackerInvite,
  removeTrackerMember,
  getMemberStats,
} from '../services/trackerAdminShared.js';

const router = express.Router();

// ── Rate Limiter ─────────────────────────────────────────────────────────────
const trackerRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests. Please try again after 15 minutes.',
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const UNAMBIGUOUS_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generatePublicCode(length = 8) {
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, UNAMBIGUOUS_ALPHABET.length);
    result += UNAMBIGUOUS_ALPHABET[idx];
  }
  return result;
}

export function generateInviteToken() {
  const rawToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export function isDemoUser(user) {
  return (
    user?.username?.toLowerCase() === 'demo' ||
    user?.id === '00000000-0000-0000-0000-000000000001'
  );
}

export function getTodayInTimezone(timezone, date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  }
}

export function addDaysString(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function isValidUUID(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function checkIsAdmin(userId) {
  const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  return rows.length > 0 && Boolean(rows[0].is_admin);
}

// ── Middlewares ──────────────────────────────────────────────────────────────
export const requireGlobalAdmin = requireAdmin;

export async function requireTrackerAdmin(req, res, next) {
  return requireAdmin(req, res, async () => {
    const { id: trackerId } = req.params;
    if (!isValidUUID(trackerId)) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }

    const tRes = await pool.query('SELECT * FROM trackers WHERE id = $1', [trackerId]);
    if (tRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
    }

    req.tracker = tRes.rows[0];
    next();
  });
}

export async function requireTrackerMember(req, res, next) {
  const { id: trackerId } = req.params;
  if (!isValidUUID(trackerId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  const userId = req.user.id;
  const memRes = await pool.query(
    `SELECT t.*, m.joined_at
     FROM trackers t
     JOIN tracker_members m ON m.tracker_id = t.id
     WHERE t.id = $1 AND m.user_id = $2`,
    [trackerId, userId]
  );

  if (memRes.rows.length === 0) {
    // Non-members get 404 on every tracker route
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  req.tracker = memRes.rows[0];
  req.membership = { joined_at: memRes.rows[0].joined_at };
  next();
}

// ── Assignment Generator Service ─────────────────────────────────────────────
export async function generateAssignments(trackerId, client) {
  const trackerRes = await client.query(
    'SELECT id, timezone, per_day, start_date::text, status FROM trackers WHERE id = $1 FOR UPDATE',
    [trackerId]
  );
  if (trackerRes.rows.length === 0) {
    throw new Error('Tracker not found');
  }
  const tracker = trackerRes.rows[0];
  if (tracker.status === 'archived') {
    return { sheetEmpty: false, sheetComplete: false, archived: true };
  }
  const timezone = tracker.timezone || 'Asia/Kolkata';
  const perDay = tracker.per_day;
  const startDateStr = tracker.start_date;

  const todayStr = getTodayInTimezone(timezone);

  // Check if sheet is empty
  const sheetCountRes = await client.query(
    'SELECT COUNT(*)::int AS count FROM tracker_sheet_items WHERE tracker_id = $1',
    [trackerId]
  );
  if (sheetCountRes.rows[0].count === 0) {
    return { sheetEmpty: true, sheetComplete: false };
  }

  // Find the last generated date
  const lastDateRes = await client.query(
    'SELECT MAX(assign_date)::text AS max_date FROM tracker_assignments WHERE tracker_id = $1',
    [trackerId]
  );
  const maxDateStr = lastDateRes.rows[0]?.max_date;

  let nextDateStr;
  if (!maxDateStr) {
    nextDateStr = startDateStr;
  } else {
    nextDateStr = addDaysString(maxDateStr, 1);
  }

  // Fetch unassigned sheet items count
  const unassignedCheck = await client.query(
    `SELECT COUNT(*)::int AS count FROM tracker_sheet_items s
     WHERE s.tracker_id = $1
       AND s.catalog_id NOT IN (
         SELECT a.catalog_id FROM tracker_assignments a WHERE a.tracker_id = $1
       )`,
    [trackerId]
  );
  const unassignedRemaining = unassignedCheck.rows[0].count;

  if (nextDateStr > todayStr) {
    return {
      sheetEmpty: false,
      sheetComplete: unassignedRemaining === 0,
    };
  }

  // Fetch all unassigned sheet items ordered by position ASC
  const unassignedRes = await client.query(
    `SELECT s.catalog_id, s.position
     FROM tracker_sheet_items s
     WHERE s.tracker_id = $1
       AND s.catalog_id NOT IN (
         SELECT a.catalog_id FROM tracker_assignments a WHERE a.tracker_id = $1
       )
     ORDER BY s.position ASC`,
    [trackerId]
  );
  const unassigned = unassignedRes.rows;

  let sheetComplete = false;
  let curDate = nextDateStr;

  while (curDate <= todayStr) {
    if (unassigned.length === 0) {
      sheetComplete = true;
      break;
    }

    const batch = unassigned.splice(0, perDay);
    for (const item of batch) {
      await client.query(
        `INSERT INTO tracker_assignments (tracker_id, assign_date, catalog_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (tracker_id, assign_date, catalog_id) DO NOTHING`,
        [trackerId, curDate, item.catalog_id]
      );
    }

    if (unassigned.length === 0) {
      sheetComplete = true;
      break;
    }

    curDate = addDaysString(curDate, 1);
  }

  return {
    sheetEmpty: false,
    sheetComplete: sheetComplete || unassigned.length === 0,
  };
}

// ── Route Authentication Router ──────────────────────────────────────────────
router.use((req, res, next) => {
  // If this is an admin route, let requireAdmin / requireTrackerAdmin handle authentication
  const isAdminRoute =
    (req.method === 'POST' && req.path === '/') ||
    req.path.includes('/requests') ||
    req.path.includes('/invites') ||
    req.path.includes('/remove') ||
    req.path.includes('/settings') ||
    req.path.includes('/sheet/');

  // Note: /invites/accept and user requests are user routes
  const isUserRoute =
    req.path === '/invites/accept' ||
    (req.method === 'POST' && req.path === '/requests') ||
    (req.method === 'DELETE' && req.path.startsWith('/requests/'));

  if (isAdminRoute && !isUserRoute) {
    return next();
  }
  return authenticateToken(req, res, next);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. NON-PARAMETERIZED ROUTES (Defined first to prevent collision with /:id)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/trackers - Admin only: Create a tracker
router.post('/', requireGlobalAdmin, async (req, res) => {
  const { name, timezone = 'Asia/Kolkata', per_day, start_date } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Tracker name is required.' });
  }

  const perDay = parseInt(per_day, 10);
  if (isNaN(perDay) || perDay < 1 || perDay > 10) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'per_day must be between 1 and 10.' });
  }

  if (!start_date || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'start_date must be in YYYY-MM-DD format.' });
  }

  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid timezone.' });
  }

  const publicCode = generatePublicCode(8);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO trackers (name, public_code, timezone, per_day, start_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, public_code, timezone, per_day, start_date::text, created_at`,
      [name.trim(), publicCode, timezone, perDay, start_date, req.user.id]
    );

    const tracker = rows[0];

    // Creator is also added as first member (from start_date if past)
    await client.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, LEAST(CURRENT_TIMESTAMP, $3::timestamptz))`,
      [tracker.id, req.user.id, start_date]
    );

    await client.query('COMMIT');
    return res.status(201).json(tracker);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/trackers/requests - Submit join request (rate-limited, generic response)
router.post('/requests', trackerRequestLimiter, async (req, res) => {
  if (isDemoUser(req.user)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Demo user cannot submit join requests.' });
  }

  const { publicCode, message } = req.body || {};
  const genericResponse = { message: 'If the tracker code is valid, your request has been submitted.' };

  if (!publicCode || typeof publicCode !== 'string') {
    return res.status(200).json(genericResponse);
  }

  const cleanCode = publicCode.trim().toUpperCase();
  const { rows: trackerRows } = await pool.query(
    'SELECT id FROM trackers WHERE UPPER(public_code) = $1',
    [cleanCode]
  );

  if (trackerRows.length === 0) {
    // Non-existent tracker returns the identical generic response
    return res.status(200).json(genericResponse);
  }

  const trackerId = trackerRows[0].id;
  const userId = req.user.id;

  // Check if user is already a member
  const memRes = await pool.query(
    'SELECT 1 FROM tracker_members WHERE tracker_id = $1 AND user_id = $2',
    [trackerId, userId]
  );
  if (memRes.rows.length > 0) {
    return res.status(409).json({
      error: 'ALREADY_MEMBER',
      message: 'You are already a member of this tracker.',
    });
  }

  // Check past join requests
  const reqRes = await pool.query(
    `SELECT status, decided_at
     FROM tracker_join_requests
     WHERE tracker_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [trackerId, userId]
  );

  if (reqRes.rows.length > 0) {
    const lastReq = reqRes.rows[0];
    if (lastReq.status === 'pending') {
      return res.status(409).json({
        error: 'REQUEST_PENDING',
        message: 'You already have a pending join request for this tracker.',
      });
    }
    if (lastReq.status === 'rejected' && lastReq.decided_at) {
      const msSinceReject = Date.now() - new Date(lastReq.decided_at).getTime();
      if (msSinceReject < 24 * 60 * 60 * 1000) {
        return res.status(429).json({
          error: 'COOLDOWN_ACTIVE',
          message: 'You must wait 24 hours after a rejection before requesting again.',
        });
      }
    }
  }

  // Insert pending request
  await pool.query(
    `INSERT INTO tracker_join_requests (tracker_id, user_id, message, status)
     VALUES ($1, $2, $3, 'pending')`,
    [trackerId, userId, message || null]
  );

  return res.status(200).json(genericResponse);
});

// GET /api/trackers/my - Return user's trackers and pending requests
router.get('/my', async (req, res) => {
  const userId = req.user.id;

  const trackersRes = await pool.query(
    `SELECT t.id, t.name, t.public_code, t.timezone, t.per_day, t.start_date::text, t.created_at, m.joined_at
     FROM trackers t
     JOIN tracker_members m ON m.tracker_id = t.id
     WHERE m.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );

  const pendingRes = await pool.query(
    `SELECT r.id, r.tracker_id, t.name AS tracker_name, r.message, r.status, r.created_at
     FROM tracker_join_requests r
     JOIN trackers t ON t.id = r.tracker_id
     WHERE r.user_id = $1 AND r.status = 'pending'
     ORDER BY r.created_at DESC`,
    [userId]
  );

  return res.status(200).json({
    trackers: trackersRes.rows,
    pendingRequests: pendingRes.rows,
  });
});

// DELETE /api/trackers/requests/:id - Cancel user's own pending request
router.delete('/requests/:id', async (req, res) => {
  const { id: reqId } = req.params;
  if (!isValidUUID(reqId)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Request not found.' });
  }

  const { rows } = await pool.query(
    `UPDATE tracker_join_requests
     SET status = 'cancelled'
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING id`,
    [reqId, req.user.id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Pending request not found.' });
  }

  return res.status(200).json({ message: 'Request cancelled.' });
});

// POST /api/trackers/invites/accept - Accept invite link
router.post('/invites/accept', async (req, res) => {
  if (isDemoUser(req.user)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Demo user cannot accept invites.' });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Invite token is required.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM tracker_invites WHERE token_hash = $1 FOR UPDATE',
      [tokenHash]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'INVITE_NOT_FOUND', message: 'Invite not found.' });
    }

    const invite = rows[0];

    if (invite.revoked_at) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'INVITE_REVOKED', message: 'This invite has been revoked.' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'INVITE_EXPIRED', message: 'This invite has expired.' });
    }

    // Check if user is already a member (idempotent, burns no uses)
    const memRes = await client.query(
      'SELECT 1 FROM tracker_members WHERE tracker_id = $1 AND user_id = $2',
      [invite.tracker_id, req.user.id]
    );

    if (memRes.rows.length > 0) {
      await client.query('COMMIT');
      return res.status(200).json({
        message: 'Already a member of this tracker.',
        trackerId: invite.tracker_id,
      });
    }

    // Check max uses
    if (invite.use_count >= invite.max_uses) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'INVITE_MAX_USES', message: 'This invite has reached its maximum uses.' });
    }

    // Burn one use and add member
    await client.query(
      'UPDATE tracker_invites SET use_count = use_count + 1 WHERE id = $1',
      [invite.id]
    );

    await client.query(
      'INSERT INTO tracker_members (tracker_id, user_id, joined_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
      [invite.tracker_id, req.user.id]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      message: 'Successfully joined tracker.',
      trackerId: invite.tracker_id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADMIN-ONLY TRACKER ROUTES (/:id/...)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/trackers/:id/requests - List join requests
router.get('/:id/requests', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId } = req.params;
  const rows = await fetchTrackerJoinRequests(trackerId);
  return res.status(200).json(rows);
});

// POST /api/trackers/:id/requests/:reqId/decision - Approve or reject join request
router.post('/:id/requests/:reqId/decision', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId, reqId } = req.params;
  const decision = (req.body?.decision || req.body?.action || '').toLowerCase();

  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ error: 'INVALID_DECISION', message: 'Decision must be approve or reject.' });
  }

  const result = await decideTrackerJoinRequest(trackerId, reqId, decision, req.user.id);
  if (result.notFound) {
    return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: 'Join request not found.' });
  }
  if (result.alreadyDecided) {
    return res.status(409).json({ error: 'ALREADY_DECIDED', message: `Request is already ${result.status}.` });
  }

  return res.status(200).json({ success: true, status: result.status });
});

// POST /api/trackers/:id/invites - Create invite link
router.post('/:id/invites', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId } = req.params;
  const { expiresInDays = 7, maxUses = 10 } = req.body || {};
  const expDays = parseInt(expiresInDays, 10) || 7;
  const uses = parseInt(maxUses, 10) || 10;

  const invite = await createTrackerInvite(trackerId, req.user.id, expDays, uses);

  return res.status(201).json({
    message: 'Invite created successfully.',
    invite,
  });
});

// DELETE /api/trackers/:id/invites/:inviteId - Revoke invite link
router.delete('/:id/invites/:inviteId', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId, inviteId } = req.params;
  const revoked = await revokeTrackerInvite(trackerId, inviteId);
  if (!revoked) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Invite not found or already revoked.' });
  }
  return res.status(200).json({ message: 'Invite revoked.' });
});

// GET /api/trackers/:id/invites - List existing invites (admin only, never returns token or token_hash)
router.get('/:id/invites', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId } = req.params;
  const invites = await fetchTrackerInvites(trackerId);
  return res.status(200).json(invites);
});

// POST /api/trackers/:id/members/:userId/remove - Remove member
router.post('/:id/members/:userId/remove', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId, userId: targetUserId } = req.params;
  const removed = await removeTrackerMember(trackerId, targetUserId);
  if (!removed) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Member not found in tracker.' });
  }
  return res.status(200).json({ message: 'Member removed.' });
});

// PUT /api/trackers/:id/settings - Update per_day or timezone (future days only)
router.put('/:id/settings', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId } = req.params;
  const { per_day, timezone } = req.body || {};

  let perDayVal = null;
  if (per_day !== undefined) {
    perDayVal = parseInt(per_day, 10);
    if (isNaN(perDayVal) || perDayVal < 1 || perDayVal > 10) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'per_day must be between 1 and 10.' });
    }
  }

  if (timezone !== undefined) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid timezone.' });
    }
  }

  const { rows } = await pool.query(
    `UPDATE trackers
     SET per_day = COALESCE($2, per_day),
         timezone = COALESCE($3, timezone)
     WHERE id = $1
     RETURNING id, name, public_code, timezone, per_day, start_date::text, created_at`,
    [trackerId, perDayVal, timezone || null]
  );

  return res.status(200).json(rows[0]);
});

// POST /api/trackers/:id/sheet/preview - Preview CSV sheet upload (writes nothing)
router.post('/:id/sheet/preview', requireTrackerAdmin, async (req, res) => {
  const { csv } = req.body || {};

  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'INVALID_CSV', message: 'CSV string is required.' });
  }

  if (Buffer.byteLength(csv, 'utf8') > 1024 * 1024) {
    return res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'CSV exceeds 1MB limit.' });
  }

  let rows;
  try {
    rows = parse(csv, { skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: 'PARSE_ERROR', message: err.message });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: 'EMPTY_CSV', message: 'CSV is empty.' });
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const lcIndex = headers.indexOf('lc_number');
  if (lcIndex === -1) {
    return res.status(400).json({ error: 'MISSING_COLUMN', message: 'Missing lc_number column in CSV.' });
  }

  const posIndex = headers.indexOf('position');
  const dataRows = rows.slice(1);
  if (dataRows.length > 1000) {
    return res.status(400).json({ error: 'TOO_MANY_ROWS', message: 'CSV exceeds 1000 rows limit.' });
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

  const lcNums = uniqueItems.map((item) => item.lc_number);
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

  return res.status(200).json({
    valid: validItems.length,
    unknown,
    duplicates,
    firstTen: validItems.slice(0, 10).map((v) => ({ lc_number: v.lc_number, title: v.title })),
  });
});

// POST /api/trackers/:id/sheet/confirm - Confirm CSV sheet and replace unassigned items
router.post('/:id/sheet/confirm', requireTrackerAdmin, async (req, res) => {
  const { id: trackerId } = req.params;
  const { csv } = req.body || {};

  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'INVALID_CSV', message: 'CSV string is required.' });
  }

  if (Buffer.byteLength(csv, 'utf8') > 1024 * 1024) {
    return res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'CSV exceeds 1MB limit.' });
  }

  let rows;
  try {
    rows = parse(csv, { skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: 'PARSE_ERROR', message: err.message });
  }

  if (rows.length === 0) {
    return res.status(400).json({ error: 'EMPTY_CSV', message: 'CSV is empty.' });
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const lcIndex = headers.indexOf('lc_number');
  if (lcIndex === -1) {
    return res.status(400).json({ error: 'MISSING_COLUMN', message: 'Missing lc_number column in CSV.' });
  }

  const posIndex = headers.indexOf('position');
  const dataRows = rows.slice(1);
  if (dataRows.length > 1000) {
    return res.status(400).json({ error: 'TOO_MANY_ROWS', message: 'CSV exceeds 1000 rows limit.' });
  }

  const seen = new Set();
  const uniqueItems = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const lcNum = parseInt(row[lcIndex]?.trim(), 10);
    if (isNaN(lcNum) || lcNum <= 0) continue;
    const pos = posIndex !== -1 && row[posIndex]?.trim() ? parseInt(row[posIndex].trim(), 10) : i + 1;

    if (!seen.has(lcNum)) {
      seen.add(lcNum);
      uniqueItems.push({ lc_number: lcNum, position: pos });
    }
  }

  const lcNums = uniqueItems.map((item) => item.lc_number);
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

    // Delete only unassigned sheet items (past assignments are never altered)
    await client.query(
      `DELETE FROM tracker_sheet_items
       WHERE tracker_id = $1
         AND catalog_id NOT IN (
           SELECT catalog_id FROM tracker_assignments WHERE tracker_id = $1
         )`,
      [trackerId]
    );

    // Insert new sheet items
    for (const item of validItems) {
      await client.query(
        `INSERT INTO tracker_sheet_items (tracker_id, catalog_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (tracker_id, catalog_id) DO UPDATE SET position = EXCLUDED.position`,
        [trackerId, item.catalog_id, item.position]
      );
    }

    await client.query('COMMIT');
    return res.status(200).json({ success: true, count: validItems.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. MEMBER-ONLY TRACKER ROUTES (/:id/...)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/trackers/:id - Get tracker details and sheet status (member only)
router.get('/:id', requireTrackerMember, async (req, res) => {
  const { id: trackerId } = req.params;
  const userId = req.user.id;

  const isAdmin = await checkIsAdmin(userId);

  // Check sheet status
  const sheetCountRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM tracker_sheet_items WHERE tracker_id = $1',
    [trackerId]
  );
  const totalSheet = sheetCountRes.rows[0].count;

  let sheetStatus = 'empty';
  if (totalSheet > 0) {
    const unassignedRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM tracker_sheet_items s
       WHERE s.tracker_id = $1
         AND s.catalog_id NOT IN (
           SELECT a.catalog_id FROM tracker_assignments a WHERE a.tracker_id = $1
         )`,
      [trackerId]
    );
    if (unassignedRes.rows[0].count === 0) {
      sheetStatus = 'complete';
    } else {
      sheetStatus = 'inProgress';
    }
  }

  return res.status(200).json({
    id: req.tracker.id,
    name: req.tracker.name,
    publicCode: isAdmin ? req.tracker.public_code : undefined,
    timezone: req.tracker.timezone,
    perDay: req.tracker.per_day,
    startDate: req.tracker.start_date,
    sheetStatus,
    sheet: { status: sheetStatus },
    createdAt: req.tracker.created_at,
  });
});

// GET /api/trackers/:id/members - List members (member only)
router.get('/:id/members', requireTrackerMember, async (req, res) => {
  const { id: trackerId } = req.params;
  const stats = await getMemberStats(trackerId, pool);
  if (!stats) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }
  return res.status(200).json(stats.members);
});

// DELETE /api/trackers/:id/leave - Leave tracker
router.delete('/:id/leave', requireTrackerMember, async (req, res) => {
  const { id: trackerId } = req.params;
  const userId = req.user.id;

  await pool.query(
    'DELETE FROM tracker_members WHERE tracker_id = $1 AND user_id = $2',
    [trackerId, userId]
  );

  return res.status(200).json({ message: 'Successfully left tracker.' });
});

// GET /api/trackers/:id/today - Fetch today's assignments
router.get('/:id/today', requireTrackerMember, async (req, res) => {
  const { id: trackerId } = req.params;
  const userId = req.user.id;
  const timezone = req.tracker.timezone || 'Asia/Kolkata';

  // Generate assignments within transaction
  let genResult;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    genResult = await generateAssignments(trackerId, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (genResult.sheetEmpty) {
    return res.status(200).json({ sheetEmpty: true, assignments: [] });
  }

  const todayStr = getTodayInTimezone(timezone);

  const { rows } = await pool.query(
    `SELECT a.id AS assignment_id, a.assign_date::text AS assign_date, a.catalog_id,
            c.lc_number, c.title, c.slug, c.difficulty, c.topic_tags,
            s.id AS submission_id, s.submitted_at, s.solution_url, s.time_taken, s.notes
     FROM tracker_assignments a
     JOIN catalog_problems c ON c.id = a.catalog_id
     LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = $1
     WHERE a.tracker_id = $2 AND a.assign_date = $3
     ORDER BY a.id ASC`,
    [userId, trackerId, todayStr]
  );

  // Fetch all current members and their submissions for today's assignments
  const { rows: trkMembers } = await pool.query(
    `SELECT m.user_id, u.username
     FROM tracker_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.tracker_id = $1
     ORDER BY m.joined_at ASC`,
    [trackerId]
  );

  const assignmentIds = rows.map((r) => r.assignment_id);
  let todaySubs = [];
  if (assignmentIds.length > 0) {
    const { rows: subRows } = await pool.query(
      `SELECT assignment_id, user_id FROM submissions WHERE assignment_id = ANY($1)`,
      [assignmentIds]
    );
    todaySubs = subRows;
  }
  const subKeySet = new Set(todaySubs.map((s) => `${s.assignment_id}:${s.user_id}`));

  const assignments = rows.map((r) => ({
    assignmentId: r.assignment_id,
    assignDate: r.assign_date,
    catalogId: r.catalog_id,
    lcNumber: r.lc_number,
    title: r.title,
    slug: r.slug,
    difficulty: r.difficulty,
    topicTags: r.topic_tags,
    url: `https://leetcode.com/problems/${r.slug}/`,
    membersStatus: trkMembers.map((m) => ({
      userId: m.user_id,
      username: m.username,
      done: subKeySet.has(`${r.assignment_id}:${m.user_id}`),
    })),
    submission: r.submission_id
      ? {
        id: r.submission_id,
        submittedAt: r.submitted_at,
        solutionUrl: r.solution_url,
        timeTaken: r.time_taken,
        notes: r.notes,
      }
      : null,
  }));

  return res.status(200).json({
    sheetEmpty: false,
    sheetComplete: Boolean(genResult.sheetComplete),
    today: todayStr,
    assignments,
  });
});

// GET /api/trackers/:id/pending - Fetch pending overdue assignments
router.get('/:id/pending', requireTrackerMember, async (req, res) => {
  const { id: trackerId } = req.params;
  const userId = req.user.id;
  const timezone = req.tracker.timezone || 'Asia/Kolkata';

  // Ensure assignments are generated through today
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await generateAssignments(trackerId, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const todayStr = getTodayInTimezone(timezone);
  const joinedDateStr = getTodayInTimezone(timezone, new Date(req.membership.joined_at));

  const { rows } = await pool.query(
    `SELECT a.id AS assignment_id, a.assign_date::text AS assign_date, a.catalog_id,
            c.lc_number, c.title, c.slug, c.difficulty, c.topic_tags
     FROM tracker_assignments a
     JOIN catalog_problems c ON c.id = a.catalog_id
     WHERE a.tracker_id = $1
       AND a.assign_date < $2
       AND a.assign_date >= $3
       AND NOT EXISTS (
         SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.user_id = $4
       )
     ORDER BY a.assign_date ASC, a.id ASC`,
    [trackerId, todayStr, joinedDateStr, userId]
  );

  const pending = rows.map((r) => ({
    assignmentId: r.assignment_id,
    assignDate: r.assign_date,
    catalogId: r.catalog_id,
    lcNumber: r.lc_number,
    title: r.title,
    slug: r.slug,
    difficulty: r.difficulty,
    topicTags: r.topic_tags,
    url: `https://leetcode.com/problems/${r.slug}/`,
  }));

  return res.status(200).json({
    pending,
    count: pending.length,
  });
});

// POST /api/trackers/:id/assignments/:assignmentId/submit - Submit solution
router.post(
  '/:id/assignments/:assignmentId/submit',
  (req, res, next) => {
    if (isDemoUser(req.user)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Demo user cannot submit solutions.' });
    }
    next();
  },
  requireTrackerMember,
  async (req, res) => {

    const { id: trackerId, assignmentId } = req.params;
    if (!isValidUUID(assignmentId)) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Assignment not found.' });
    }

    const { solutionUrl, timeTaken, notes } = req.body || {};

    if (!solutionUrl || typeof solutionUrl !== 'string' || !isValidHttpUrl(solutionUrl)) {
      return res.status(400).json({
        error: 'INVALID_URL',
        message: 'solutionUrl is required and must begin with http:// or https://',
      });
    }

    const userId = req.user.id;

    // Check assignment exists and belongs to this tracker
    const assignRes = await pool.query(
      `SELECT a.*, c.title, c.slug, c.difficulty
     FROM tracker_assignments a
     JOIN catalog_problems c ON c.id = a.catalog_id
     WHERE a.id = $1 AND a.tracker_id = $2`,
      [assignmentId, trackerId]
    );

    if (assignRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Assignment not found.' });
    }

    const assignment = assignRes.rows[0];

    // Check if already submitted
    const subCheck = await pool.query(
      'SELECT id FROM submissions WHERE user_id = $1 AND assignment_id = $2',
      [userId, assignmentId]
    );
    if (subCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'ALREADY_SUBMITTED',
        message: 'You have already submitted for this assignment.',
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create or reuse the caller's own problems row via catalog_id
      const probCheck = await client.query(
        'SELECT id FROM problems WHERE user_id = $1 AND catalog_id = $2 LIMIT 1',
        [userId, assignment.catalog_id]
      );

      let problemId;
      if (probCheck.rows.length > 0) {
        problemId = probCheck.rows[0].id;
      } else {
        const insertProb = await client.query(
          `INSERT INTO problems (
           user_id, title, platform, problem_url, submission_url,
           difficulty, solving_status, time_taken_minutes, solved_at, catalog_id
         ) VALUES ($1, $2, 'LeetCode', $3, $4, $5, 'Solved Independently', $6, CURRENT_DATE, $7)
         RETURNING id`,
          [
            userId,
            assignment.title,
            `https://leetcode.com/problems/${assignment.slug}/`,
            solutionUrl,
            assignment.difficulty || 'Medium',
            timeTaken ? parseInt(timeTaken, 10) : null,
            assignment.catalog_id,
          ]
        );
        problemId = insertProb.rows[0].id;
      }

      // Insert into submissions
      const subRes = await client.query(
        `INSERT INTO submissions (user_id, assignment_id, solution_url, time_taken, notes, problem_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, submitted_at, solution_url, time_taken, notes, problem_id`,
        [
          userId,
          assignmentId,
          solutionUrl,
          timeTaken ? parseInt(timeTaken, 10) : null,
          notes || null,
          problemId,
        ]
      );

      await client.query('COMMIT');
      return res.status(201).json({
        message: 'Submission recorded successfully.',
        submission: subRes.rows[0],
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

// GET /api/trackers/:id/board - Leaderboard / member stats (done today, pending count, streak)
router.get('/:id/board', requireTrackerMember, async (req, res) => {
  const { id: trackerId } = req.params;

  // Ensure assignments generated through today
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await generateAssignments(trackerId, client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const stats = await getMemberStats(trackerId, pool);
  if (!stats) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Tracker not found.' });
  }

  return res.status(200).json({
    room: stats.room,
    members: stats.members,
    board: stats.members,
  });
});

export default router;
