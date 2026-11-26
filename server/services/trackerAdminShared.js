import crypto from 'crypto';
import { pool } from '../../db/pool.js';
import { parse } from 'csv-parse/sync';

export function generateInviteToken() {
  const rawToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export async function fetchTrackerDetails(trackerId) {
  const { rows: tRows } = await pool.query('SELECT * FROM trackers WHERE id = $1', [trackerId]);
  if (tRows.length === 0) {
    return null;
  }
  const tracker = tRows[0];

  const { rows: sheetCountRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM tracker_sheet_items WHERE tracker_id = $1',
    [trackerId]
  );
  const totalSheet = sheetCountRows[0]?.count || 0;

  let sheetStatus = 'empty';
  if (totalSheet > 0) {
    const { rows: unassignedRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM tracker_sheet_items s
       WHERE s.tracker_id = $1
         AND s.catalog_id NOT IN (
           SELECT a.catalog_id FROM tracker_assignments a WHERE a.tracker_id = $1
         )`,
      [trackerId]
    );
    if (unassignedRows[0]?.count === 0) {
      sheetStatus = 'complete';
    } else {
      sheetStatus = 'inProgress';
    }
  }

  return {
    id: tracker.id,
    name: tracker.name,
    publicCode: tracker.public_code,
    public_code: tracker.public_code,
    timezone: tracker.timezone,
    perDay: tracker.per_day,
    per_day: tracker.per_day,
    startDate: tracker.start_date,
    start_date: tracker.start_date,
    status: tracker.status || 'active',
    sheetStatus,
    sheet: { status: sheetStatus },
    createdAt: tracker.created_at,
    created_at: tracker.created_at,
  };
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

export async function getMemberStats(trackerId, client = pool) {
  const { rows: tRows } = await client.query(
    'SELECT id, timezone, per_day, start_date::text, status FROM trackers WHERE id = $1',
    [trackerId]
  );
  if (tRows.length === 0) {
    return null;
  }
  const tracker = tRows[0];
  const timezone = tracker.timezone || 'Asia/Kolkata';
  const todayStr = getTodayInTimezone(timezone);

  // 1. Room-level stats
  const { rows: sheetRows } = await client.query(
    `SELECT 
       COUNT(*)::int AS sheet_total,
       COUNT(CASE WHEN catalog_id NOT IN (
         SELECT catalog_id FROM tracker_assignments WHERE tracker_id = $1
       ) THEN 1 END)::int AS sheet_remaining
     FROM tracker_sheet_items
     WHERE tracker_id = $1`,
    [trackerId]
  );
  const sheetTotal = sheetRows[0]?.sheet_total || 0;
  const sheetRemaining = sheetRows[0]?.sheet_remaining || 0;
  const sheetComplete = sheetTotal > 0 && sheetRemaining === 0;

  const { rows: assignSummaryRows } = await client.query(
    `SELECT 
       COUNT(*)::int AS released_total,
       COUNT(DISTINCT assign_date)::int AS day_number
     FROM tracker_assignments
     WHERE tracker_id = $1 AND assign_date <= $2::date`,
    [trackerId, todayStr]
  );
  const releasedTotal = assignSummaryRows[0]?.released_total || 0;
  const dayNumber = assignSummaryRows[0]?.day_number || 0;

  const room = {
    releasedTotal,
    sheetTotal,
    sheetRemaining,
    dayNumber,
    sheetComplete,
  };

  // 2. Member aggregations computed in SQL with timezone-awareness
  const { rows: memberStatsRows } = await client.query(
    `SELECT 
       m.user_id,
       u.username,
       m.joined_at,
       to_char(m.joined_at AT TIME ZONE t.timezone, 'YYYY-MM-DD') AS join_date_str,
       COUNT(a.id)::int AS released,
       COUNT(s.id)::int AS submitted,
       COUNT(CASE WHEN s.id IS NOT NULL AND to_char(s.submitted_at AT TIME ZONE t.timezone, 'YYYY-MM-DD') = a.assign_date::text THEN 1 END)::int AS on_time,
       COUNT(CASE WHEN s.id IS NOT NULL AND to_char(s.submitted_at AT TIME ZONE t.timezone, 'YYYY-MM-DD') <> a.assign_date::text THEN 1 END)::int AS late,
       COUNT(CASE WHEN a.assign_date < $2::date AND s.id IS NULL THEN 1 END)::int AS pending,
       COUNT(CASE WHEN a.assign_date = $2::date AND s.id IS NOT NULL THEN 1 END)::int AS today_done,
       COUNT(CASE WHEN a.assign_date = $2::date THEN 1 END)::int AS today_total,
       MAX(s.submitted_at) AS last_submitted_at
     FROM tracker_members m
     JOIN users u ON u.id = m.user_id
     CROSS JOIN (SELECT id, timezone FROM trackers WHERE id = $1) t
     LEFT JOIN tracker_assignments a 
       ON a.tracker_id = m.tracker_id
      AND a.assign_date <= $2::date 
      AND a.assign_date >= (m.joined_at AT TIME ZONE t.timezone)::date
     LEFT JOIN submissions s 
       ON s.assignment_id = a.id 
      AND s.user_id = m.user_id
     WHERE m.tracker_id = $1
     GROUP BY m.user_id, u.username, m.joined_at, t.timezone
     ORDER BY m.joined_at ASC`,
    [trackerId, todayStr]
  );

  // 3. For streak calculation (existing on-time rule):
  const { rows: allAssignments } = await client.query(
    `SELECT id, assign_date::text AS assign_date
     FROM tracker_assignments
     WHERE tracker_id = $1 AND assign_date <= $2::date
     ORDER BY assign_date ASC`,
    [trackerId, todayStr]
  );

  const { rows: allSubmissions } = await client.query(
    `SELECT s.user_id, s.assignment_id, a.assign_date::text AS assign_date, s.submitted_at
     FROM submissions s
     JOIN tracker_assignments a ON a.id = s.assignment_id
     WHERE a.tracker_id = $1 AND a.assign_date <= $2::date`,
    [trackerId, todayStr]
  );

  const userSubsMap = new Map();
  for (const sub of allSubmissions) {
    if (!userSubsMap.has(sub.user_id)) {
      userSubsMap.set(sub.user_id, new Map());
    }
    userSubsMap.get(sub.user_id).set(sub.assignment_id, sub);
  }

  const members = memberStatsRows.map((r) => {
    const userId = r.user_id;
    const joinDateStr = r.join_date_str;
    const memberAssignments = allAssignments.filter((a) => a.assign_date >= joinDateStr);
    const subMap = userSubsMap.get(userId) || new Map();

    const assignmentsByDate = new Map();
    for (const a of memberAssignments) {
      if (!assignmentsByDate.has(a.assign_date)) {
        assignmentsByDate.set(a.assign_date, []);
      }
      assignmentsByDate.get(a.assign_date).push(a);
    }

    const sortedDates = Array.from(assignmentsByDate.keys()).sort(); // ascending
    let streak = 0;

    const todayAssignments = assignmentsByDate.get(todayStr) || [];
    const todayDoneOnTime =
      todayAssignments.length > 0 &&
      todayAssignments.every((a) => {
        const sub = subMap.get(a.id);
        if (!sub) return false;
        const subDate = getTodayInTimezone(timezone, new Date(sub.submitted_at));
        return subDate === a.assign_date;
      });

    let checkIndex = sortedDates.indexOf(todayStr);
    if (checkIndex === -1) {
      checkIndex = sortedDates.length - 1;
    } else if (!todayDoneOnTime) {
      checkIndex -= 1;
    }

    for (let i = checkIndex; i >= 0; i--) {
      const date = sortedDates[i];
      const dayAssigns = assignmentsByDate.get(date);
      const allOnTime =
        dayAssigns.length > 0 &&
        dayAssigns.every((a) => {
          const sub = subMap.get(a.id);
          if (!sub) return false;
          const subDate = getTodayInTimezone(timezone, new Date(sub.submitted_at));
          return subDate === a.assign_date;
        });

      if (allOnTime) {
        streak++;
      } else {
        break;
      }
    }

    const released = r.released;
    const submitted = r.submitted;
    const completionPct = released === 0 ? 0 : Math.round((submitted / released) * 100);

    return {
      userId,
      user_id: userId,
      username: r.username,
      joinedAt: r.joined_at,
      joined_at: r.joined_at,
      released,
      submitted,
      onTime: r.on_time,
      on_time: r.on_time,
      late: r.late,
      pending: r.pending,
      pendingCount: r.pending,
      pending_count: r.pending,
      todayDone: r.today_done,
      today_done: r.today_done,
      doneToday: r.today_done,
      done_today: r.today_done,
      todayTotal: r.today_total,
      today_total: r.today_total,
      completionPct,
      completion_pct: completionPct,
      streak,
      on_time_streak: streak,
      lastSubmittedAt: r.last_submitted_at ? new Date(r.last_submitted_at).toISOString() : null,
      last_submitted_at: r.last_submitted_at ? new Date(r.last_submitted_at).toISOString() : null,
    };
  });

  return { room, members };
}

export async function fetchTrackerMembers(trackerId, client = pool) {
  const stats = await getMemberStats(trackerId, client);
  return stats ? stats.members : [];
}

export async function removeTrackerMember(trackerId, userId) {
  const { rows } = await pool.query(
    'DELETE FROM tracker_members WHERE tracker_id = $1 AND user_id = $2 RETURNING tracker_id',
    [trackerId, userId]
  );
  return rows.length > 0;
}

export async function fetchTrackerJoinRequests(trackerId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.user_id, u.username, r.message, r.status, r.created_at, r.decided_at
     FROM tracker_join_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.tracker_id = $1
     ORDER BY r.created_at DESC`,
    [trackerId]
  );
  return rows;
}

export async function decideTrackerJoinRequest(trackerId, reqId, decision, decidedByUserId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM tracker_join_requests WHERE id = $1 AND tracker_id = $2 FOR UPDATE',
      [reqId, trackerId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { notFound: true };
    }

    const request = rows[0];
    if (request.status !== 'pending') {
      await client.query('ROLLBACK');
      return { alreadyDecided: true, status: request.status };
    }

    if (decision === 'approve') {
      await client.query(
        `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (tracker_id, user_id) DO NOTHING`,
        [trackerId, request.user_id]
      );
      await client.query(
        `UPDATE tracker_join_requests
         SET status = 'approved', decided_by = $1, decided_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [decidedByUserId, reqId]
      );
    } else {
      await client.query(
        `UPDATE tracker_join_requests
         SET status = 'rejected', decided_by = $1, decided_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [decidedByUserId, reqId]
      );
    }

    await client.query('COMMIT');
    return { success: true, status: decision === 'approve' ? 'approved' : 'rejected' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function fetchTrackerInvites(trackerId) {
  const { rows } = await pool.query(
    `SELECT id, expires_at, max_uses, use_count, (revoked_at IS NOT NULL) AS revoked, created_at
     FROM tracker_invites
     WHERE tracker_id = $1
     ORDER BY created_at DESC`,
    [trackerId]
  );

  return rows.map((r) => ({
    id: r.id,
    expiresAt: r.expires_at,
    expires_at: r.expires_at,
    maxUses: r.max_uses,
    max_uses: r.max_uses,
    useCount: r.use_count,
    use_count: r.use_count,
    revoked: Boolean(r.revoked),
    createdAt: r.created_at,
    created_at: r.created_at,
  }));
}

export async function createTrackerInvite(trackerId, createdByUserId, expiresInDays = 7, maxUses = 10) {
  const { rawToken, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `INSERT INTO tracker_invites (tracker_id, token_hash, created_by, expires_at, max_uses, use_count)
     VALUES ($1, $2, $3, $4, $5, 0)
     RETURNING id, expires_at, max_uses, use_count, created_at`,
    [trackerId, tokenHash, createdByUserId, expiresAt, maxUses]
  );

  return {
    ...rows[0],
    token: rawToken, // returned ONCE only!
  };
}

export async function revokeTrackerInvite(trackerId, inviteId) {
  const { rows } = await pool.query(
    `UPDATE tracker_invites
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tracker_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [inviteId, trackerId]
  );
  return rows.length > 0;
}
