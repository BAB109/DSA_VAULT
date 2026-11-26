/**
 * Tracker Stats & Room UI Contract Test Suite (server/test-tracker-stats.js)
 *
 * Verifies:
 * a. released counts from the member's join date; a late joiner does not get earlier assignments counted
 * b. on-time vs late split, including a submission at 23:59 vs 00:01 tracker time
 * c. pending excludes today's assignments and submitted ones
 * d. completionPct is 0 (not NaN) for a member with 0 released
 * e. a removed member disappears from the table; a non-member gets 404 on /board
 * f. responses contain no notes, solution URLs, tokens or password fields
 * g. two members with different join dates get different released counts
 * h. sheetRemaining and sheetComplete are right when the sheet runs out
 * i. an empty sheet returns zeros without errors
 * j. the admin endpoint works for an admin who is NOT a member, returns identical numbers to /board for the same tracker, and returns 404 with a normal token
 */

import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { getTodayInTimezone, addDaysString } from './routes/trackers.js';
import { getMemberStats } from './services/trackerAdminShared.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'vault_admin_jwt_secret_super_secure_32_chars!';

async function req(path, options = {}, token = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

async function registerUser(username, password = 'Password123!') {
  const res = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 201) {
    throw new Error(`Failed to register user ${username}: ${JSON.stringify(res.data)}`);
  }
  return {
    id: res.data.user.id,
    username: res.data.user.username,
    token: res.data.token,
  };
}

async function runTrackerStatsTests() {
  console.log('📊 Starting Tracker Member Stats & Room UI Tests...\n');
  const timestamp = Date.now();
  const cleanupUserIds = [];
  const cleanupTrackerIds = [];

  async function cleanup() {
    console.log('\n🧹 Cleaning up test users and trackers...');
    if (cleanupTrackerIds.length > 0) {
      try {
        await pool.query('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM tracker_assignments WHERE tracker_id = ANY($1))', [cleanupTrackerIds]);
        await pool.query('DELETE FROM tracker_assignments WHERE tracker_id = ANY($1)', [cleanupTrackerIds]);
        await pool.query('DELETE FROM tracker_sheet_items WHERE tracker_id = ANY($1)', [cleanupTrackerIds]);
        await pool.query('DELETE FROM tracker_join_requests WHERE tracker_id = ANY($1)', [cleanupTrackerIds]);
        await pool.query('DELETE FROM tracker_invites WHERE tracker_id = ANY($1)', [cleanupTrackerIds]);
        await pool.query('DELETE FROM tracker_members WHERE tracker_id = ANY($1)', [cleanupTrackerIds]);
        await pool.query('DELETE FROM admin_audit_log WHERE tracker_id = ANY($1)', [cleanupTrackerIds]);
        await pool.query('DELETE FROM trackers WHERE id = ANY($1)', [cleanupTrackerIds]);
      } catch (err) {
        console.warn('Tracker cleanup error:', err.message);
      }
    }
    if (cleanupUserIds.length > 0) {
      try {
        await pool.query('DELETE FROM admin_audit_log WHERE admin_id = ANY($1)', [cleanupUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [cleanupUserIds]);
      } catch (err) {
        console.warn('User cleanup error:', err.message);
      }
    }
  }

  try {
    // 0. Setup: Register Admin & Test Users
    const adminUser = await registerUser(`stat_admin_${timestamp}`);
    cleanupUserIds.push(adminUser.id);
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [adminUser.id]);
    const adminToken = jwt.sign(
      { sub: adminUser.id, scope: 'admin' },
      ADMIN_JWT_SECRET,
      { expiresIn: '2h' }
    );

    const memberA = await registerUser(`stat_mem_a_${timestamp}`);
    cleanupUserIds.push(memberA.id);

    const memberB = await registerUser(`stat_mem_b_${timestamp}`);
    cleanupUserIds.push(memberB.id);

    const nonMember = await registerUser(`stat_non_mem_${timestamp}`);
    cleanupUserIds.push(nonMember.id);

    // Fetch catalog problems
    const { rows: catProblems } = await pool.query(
      'SELECT id, lc_number, title, slug, difficulty FROM catalog_problems ORDER BY lc_number ASC LIMIT 10'
    );
    assert.ok(catProblems.length >= 6, 'Catalog problems needed for tests');

    const tz = 'Asia/Kolkata';
    const todayStr = getTodayInTimezone(tz);
    const twoDaysAgoStr = addDaysString(todayStr, -2); // Day 1
    const yesterdayStr = addDaysString(todayStr, -1);  // Day 2

    // Create a Tracker starting 2 days ago, 1 problem per day
    const trackerRes = await req(
      '/admin/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: `Stats Test Tracker ${timestamp}`,
          per_day: 1,
          start_date: twoDaysAgoStr,
          timezone: tz,
        }),
      },
      adminToken
    );
    assert.strictEqual(trackerRes.status, 201);
    const trackerId = trackerRes.data.id;
    cleanupTrackerIds.push(trackerId);

    // Upload 5 problems into sheet
    const sheetCsv = catProblems.slice(0, 5).map((p, idx) => `${p.lc_number},${idx + 1}`).join('\n');
    const uploadRes = await req(
      `/admin/trackers/${trackerId}/sheet/confirm`,
      { method: 'POST', body: JSON.stringify({ csv: `lc_number,position\n${sheetCsv}` }) },
      adminToken
    );
    assert.strictEqual(uploadRes.status, 200);

    // Add Member A joining at twoDaysAgoStr (Day 1)
    await pool.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, ($3::date + time '10:00:00') AT TIME ZONE $4)`,
      [trackerId, memberA.id, twoDaysAgoStr, tz]
    );

    // Add Member B joining at todayStr (Day 3)
    await pool.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, ($3::date + time '10:00:00') AT TIME ZONE $4)`,
      [trackerId, memberB.id, todayStr, tz]
    );

    // Call /board to trigger daily assignment generation through today (3 days: twoDaysAgo, yesterday, today)
    const boardInit = await req(`/trackers/${trackerId}/board`, {}, memberA.token);
    assert.strictEqual(boardInit.status, 200);

    const { rows: assignments } = await pool.query(
      'SELECT id, assign_date::text AS assign_date FROM tracker_assignments WHERE tracker_id = $1 ORDER BY assign_date ASC',
      [trackerId]
    );
    assert.strictEqual(assignments.length, 3, 'Should have 3 assignments generated (Day 1, 2, 3)');
    const [assignDay1, assignDay2, assignDay3] = assignments;

    // =========================================================================
    // Test a: released counts from member's join date; late joiner doesn't get earlier
    // =========================================================================
    console.log('--- Test a: Join date assignment release isolation ---');
    const statsA = await getMemberStats(trackerId);
    const memAStats = statsA.members.find((m) => m.userId === memberA.id);
    const memBStats = statsA.members.find((m) => m.userId === memberB.id);

    // Member A joined Day 1 (twoDaysAgo), so Day 1, Day 2, Day 3 are released = 3
    assert.strictEqual(memAStats.released, 3, 'Member A should have 3 released assignments');
    // Member B joined Day 3 (today), so only Day 3 is released = 1
    assert.strictEqual(memBStats.released, 1, 'Member B should have 1 released assignment');
    console.log('  ✅ Test a passed.');

    // =========================================================================
    // Test b: on-time vs late split, including 23:59 vs 00:01 tracker time
    // =========================================================================
    console.log('--- Test b: On-time vs Late submission boundary (23:59 vs 00:01) ---');
    // Member A submits Day 1 on-time at 23:59:00 in Asia/Kolkata
    // Day 1 date: twoDaysAgoStr. In Kolkata (UTC+5:30), 23:59:00 is 18:29:00 UTC
    const day1OnTimeUtc = `${twoDaysAgoStr} 18:29:00+00`;
    await pool.query(
      `INSERT INTO submissions (assignment_id, user_id, submitted_at, time_taken, solution_url)
       VALUES ($1, $2, $3::timestamptz, 20, 'https://leetcode.com/problems/test/solutions/1')`,
      [assignDay1.id, memberA.id, day1OnTimeUtc]
    );

    // Member A submits Day 2 LATE at 00:01:00 the next day in Asia/Kolkata
    // Day 2 date: yesterdayStr. Day 2 ended at 23:59:59. At 00:01:00 on Day 3 (todayStr 00:01:00 in Kolkata = yesterdayStr 18:31:00 UTC)
    const day2LateUtc = `${yesterdayStr} 18:31:00+00`;
    await pool.query(
      `INSERT INTO submissions (assignment_id, user_id, submitted_at, time_taken, solution_url)
       VALUES ($1, $2, $3::timestamptz, 25, 'https://leetcode.com/problems/test/solutions/2')`,
      [assignDay2.id, memberA.id, day2LateUtc]
    );

    const statsB = await getMemberStats(trackerId);
    const memAAfterSubs = statsB.members.find((m) => m.userId === memberA.id);

    assert.strictEqual(memAAfterSubs.submitted, 2, 'Member A should have 2 submitted assignments');
    assert.strictEqual(memAAfterSubs.onTime, 1, 'Member A should have exactly 1 on-time submission');
    assert.strictEqual(memAAfterSubs.late, 1, 'Member A should have exactly 1 late submission');
    console.log('  ✅ Test b passed.');

    // =========================================================================
    // Test c: pending excludes today's assignments and submitted ones
    // =========================================================================
    console.log('--- Test c: Pending calculation excludes today and completed ---');
    // For Member A:
    // Day 1: submitted (not pending)
    // Day 2: submitted late (not pending)
    // Day 3 (today): not submitted, but it's today so NOT pending
    // Therefore pending for Member A should be 0!
    assert.strictEqual(memAAfterSubs.pending, 0, 'Member A pending should be 0 because past days are submitted');

    // For Member B:
    // Joined Day 3 (today). Day 3 is not submitted, but it is today!
    // Therefore pending for Member B should be 0!
    const memBAfterSubs = statsB.members.find((m) => m.userId === memberB.id);
    assert.strictEqual(memBAfterSubs.pending, 0, 'Member B pending should be 0 (today is not pending)');

    // Now let's remove Member A's submission on Day 2 to test pending detection
    await pool.query('DELETE FROM submissions WHERE assignment_id = $1 AND user_id = $2', [assignDay2.id, memberA.id]);
    const statsCPending = await getMemberStats(trackerId);
    const memAPending = statsCPending.members.find((m) => m.userId === memberA.id);
    assert.strictEqual(memAPending.pending, 1, 'Member A should now have 1 pending (Day 2 overdue)');
    console.log('  ✅ Test c passed.');

    // =========================================================================
    // Test d: completionPct is 0 (not NaN) for a member with 0 released
    // =========================================================================
    console.log('--- Test d: completionPct is 0 for member with 0 released ---');
    // Add Member C joining in the future (tomorrow)
    const tomorrowStr = addDaysString(todayStr, 1);
    const memberC = await registerUser(`stat_mem_c_${timestamp}`);
    cleanupUserIds.push(memberC.id);
    await pool.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, ($3::date + time '10:00:00') AT TIME ZONE $4)`,
      [trackerId, memberC.id, tomorrowStr, tz]
    );

    const statsD = await getMemberStats(trackerId);
    const memCStats = statsD.members.find((m) => m.userId === memberC.id);
    assert.strictEqual(memCStats.released, 0, 'Member C should have 0 released');
    assert.strictEqual(memCStats.completionPct, 0, 'Member C completionPct must be 0 (not NaN)');
    assert.strictEqual(typeof memCStats.completionPct, 'number');
    console.log('  ✅ Test d passed.');

    // =========================================================================
    // Test e: removed member disappears from table; non-member gets 404 on /board
    // =========================================================================
    console.log('--- Test e: Removed member disappears and non-member gets 404 ---');
    // Remove Member C
    await pool.query('DELETE FROM tracker_members WHERE tracker_id = $1 AND user_id = $2', [trackerId, memberC.id]);
    const statsE = await getMemberStats(trackerId);
    assert.strictEqual(statsE.members.some((m) => m.userId === memberC.id), false, 'Removed member should not be in stats');

    // Non-member calling GET /api/trackers/:id/board gets 404
    const nonMemberBoard = await req(`/trackers/${trackerId}/board`, {}, nonMember.token);
    assert.strictEqual(nonMemberBoard.status, 404, 'Non-member must get 404 on /board');
    console.log('  ✅ Test e passed.');

    // =========================================================================
    // Test f: responses contain no notes, solution URLs, tokens or password fields
    // =========================================================================
    console.log('--- Test f: Sensitive data isolation audit ---');
    const boardRes = await req(`/trackers/${trackerId}/board`, {}, memberA.token);
    assert.strictEqual(boardRes.status, 200);

    const forbiddenFields = ['notes', 'solutionUrl', 'solution_url', 'token', 'adminToken', 'password', 'passwordHash', 'password_hash'];
    function auditObject(obj, prefix = '') {
      if (!obj || typeof obj !== 'object') return;
      for (const [key, value] of Object.entries(obj)) {
        assert.ok(!forbiddenFields.includes(key), `Forbidden sensitive key "${key}" found in response at ${prefix}`);
        if (typeof value === 'object' && value !== null) {
          auditObject(value, `${prefix}.${key}`);
        }
      }
    }
    auditObject(boardRes.data);
    console.log('  ✅ Test f passed: Zero sensitive notes/urls/tokens/hashes exposed.');

    // =========================================================================
    // Test g: two members with different join dates get different released counts
    // =========================================================================
    console.log('--- Test g: Different join dates yield different released counts ---');
    const boardMembers = boardRes.data.members;
    const bMemA = boardMembers.find((m) => m.userId === memberA.id);
    const bMemB = boardMembers.find((m) => m.userId === memberB.id);
    assert.strictEqual(bMemA.released, 3);
    assert.strictEqual(bMemB.released, 1);
    assert.notStrictEqual(bMemA.released, bMemB.released);
    console.log('  ✅ Test g passed.');

    // =========================================================================
    // Test h: sheetRemaining and sheetComplete are right when sheet runs out
    // =========================================================================
    console.log('--- Test h: sheetRemaining and sheetComplete when sheet exhausted ---');
    // Create tracker with 2 sheet items, starting 2 days ago, 1/day -> Day 1 & Day 2 assign both
    const exhaustTrackerRes = await req(
      '/admin/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: `Exhaust Tracker ${timestamp}`,
          per_day: 1,
          start_date: twoDaysAgoStr,
          timezone: tz,
        }),
      },
      adminToken
    );
    const exhaustTrackerId = exhaustTrackerRes.data.id;
    cleanupTrackerIds.push(exhaustTrackerId);

    // Upload exactly 2 problems
    const twoSheetCsv = catProblems.slice(0, 2).map((p, idx) => `${p.lc_number},${idx + 1}`).join('\n');
    await req(
      `/admin/trackers/${exhaustTrackerId}/sheet/confirm`,
      { method: 'POST', body: JSON.stringify({ csv: `lc_number,position\n${twoSheetCsv}` }) },
      adminToken
    );

    // Add Member A to exhaust tracker
    await pool.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, ($3::date + time '10:00:00') AT TIME ZONE $4)`,
      [exhaustTrackerId, memberA.id, twoDaysAgoStr, tz]
    );

    // Call /board to generate assignments
    const exhaustBoard = await req(`/trackers/${exhaustTrackerId}/board`, {}, memberA.token);
    assert.strictEqual(exhaustBoard.status, 200);

    const exhaustRoom = exhaustBoard.data.room;
    assert.strictEqual(exhaustRoom.sheetTotal, 2, 'Total sheet items should be 2');
    assert.strictEqual(exhaustRoom.sheetRemaining, 0, 'sheetRemaining should be 0 when all items assigned');
    assert.strictEqual(exhaustRoom.sheetComplete, true, 'sheetComplete must be true when sheet runs out');
    console.log('  ✅ Test h passed.');

    // =========================================================================
    // Test i: empty sheet returns zeros without errors
    // =========================================================================
    console.log('--- Test i: Empty sheet returns zero stats without errors ---');
    const emptyTrackerRes = await req(
      '/admin/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: `Empty Sheet Tracker ${timestamp}`,
          per_day: 2,
          start_date: todayStr,
          timezone: tz,
        }),
      },
      adminToken
    );
    const emptyTrackerId = emptyTrackerRes.data.id;
    cleanupTrackerIds.push(emptyTrackerId);

    // Add Member A to empty tracker
    await pool.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, now())`,
      [emptyTrackerId, memberA.id]
    );

    const emptyBoard = await req(`/trackers/${emptyTrackerId}/board`, {}, memberA.token);
    assert.strictEqual(emptyBoard.status, 200);
    assert.strictEqual(emptyBoard.data.room.sheetTotal, 0);
    assert.strictEqual(emptyBoard.data.room.sheetRemaining, 0);
    assert.strictEqual(emptyBoard.data.room.releasedTotal, 0);
    assert.strictEqual(emptyBoard.data.room.dayNumber, 0);
    assert.strictEqual(emptyBoard.data.room.sheetComplete, false);

    const emptyMemA = emptyBoard.data.members[0];
    assert.strictEqual(emptyMemA.released, 0);
    assert.strictEqual(emptyMemA.submitted, 0);
    assert.strictEqual(emptyMemA.onTime, 0);
    assert.strictEqual(emptyMemA.late, 0);
    assert.strictEqual(emptyMemA.pending, 0);
    assert.strictEqual(emptyMemA.completionPct, 0);
    assert.strictEqual(emptyMemA.streak, 0);
    console.log('  ✅ Test i passed.');

    // =========================================================================
    // Test j: Admin endpoint works for non-member admin, returns identical numbers
    //         to /board for the same tracker, and returns 404 with normal token
    // =========================================================================
    console.log('--- Test j: Admin endpoint parity and non-member execution ---');
    // Admin is NOT a member of trackerId
    const adminMembersRes = await req(`/admin/trackers/${trackerId}/members`, {}, adminToken);
    assert.strictEqual(adminMembersRes.status, 200);

    const adminMembers = Array.isArray(adminMembersRes.data) ? adminMembersRes.data : adminMembersRes.data.members;
    const trackerBoardRes = await req(`/trackers/${trackerId}/board`, {}, memberA.token);
    assert.strictEqual(trackerBoardRes.status, 200);
    const boardMembersList = trackerBoardRes.data.members;

    assert.strictEqual(adminMembers.length, boardMembersList.length, 'Admin and /board should return same member count');
    for (let i = 0; i < adminMembers.length; i++) {
      const aMem = adminMembers[i];
      const bMem = boardMembersList.find((m) => m.userId === aMem.userId);
      assert.ok(bMem, `Member ${aMem.userId} must be present in both`);
      assert.strictEqual(aMem.released, bMem.released, 'released must match');
      assert.strictEqual(aMem.submitted, bMem.submitted, 'submitted must match');
      assert.strictEqual(aMem.onTime, bMem.onTime, 'onTime must match');
      assert.strictEqual(aMem.late, bMem.late, 'late must match');
      assert.strictEqual(aMem.pending, bMem.pending, 'pending must match');
      assert.strictEqual(aMem.todayDone, bMem.todayDone, 'todayDone must match');
      assert.strictEqual(aMem.todayTotal, bMem.todayTotal, 'todayTotal must match');
      assert.strictEqual(aMem.completionPct, bMem.completionPct, 'completionPct must match');
      assert.strictEqual(aMem.streak, bMem.streak, 'streak must match');
    }

    // Normal user token calling /api/admin/trackers/:id/members gets 404
    const normalOnAdmin = await req(`/admin/trackers/${trackerId}/members`, {}, memberA.token);
    assert.strictEqual(normalOnAdmin.status, 404, 'Normal token on admin route must return 404');
    console.log('  ✅ Test j passed.');

    console.log('\n🎉 ALL TRACKER STATS TESTS (a through j) PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await cleanup();
  }
}

runTrackerStatsTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Tracker Stats Test Failed:', err);
    process.exit(1);
  });
