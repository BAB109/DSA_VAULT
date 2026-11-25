/**
 * Comprehensive Trackers Test Suite
 *
 * Covers:
 * a. Non-admin permissions & is_admin immutable via API
 * b. Non-member 404 isolation & cross-tracker submission refusal
 * c. Join request lifecycle, cooldown, and generic invalid code response
 * d. Invite tokens, hashing, expiration, revocation, and use burning
 * e. Concurrent approval deduplication
 * f. CSV preview validation, unknown problem rejection, and past assignment preservation
 * g. Empty sheet handling
 * h. Backfill generation & 10 parallel /today concurrency
 * i. Pending assignment calculation and late joiner isolation
 * j. Duplicate submission 409 & vault problem row creation/reuse
 * k. Sheet exhaustion (sheetComplete) & settings update safety
 * l. Timezone rollover boundary
 * m. Demo user restrictions & javascript: solutionUrl rejection
 */

import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import app from './server.js';
import {
  generatePublicCode,
  generateInviteToken,
  getTodayInTimezone,
  addDaysString,
} from './routes/trackers.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
let localServer = null;

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

async function runTrackersTests() {
  console.log('🏁 Starting Comprehensive Trackers Test Suite...\n');

  // Ensure server is reachable, start in-process server if not
  try {
    const probe = await fetch('http://localhost:5000/api/health').catch(() => null);
    if (!probe || !probe.ok) {
      localServer = app.listen(5000);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    localServer = app.listen(5000);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const timestamp = Date.now();
  const cleanupUserIds = [];

  try {
    // Setup Admin user
    const admin = await registerUser(`trk_admin_${timestamp}`);
    cleanupUserIds.push(admin.id);
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [admin.id]);

    // Setup Normal User A and User B
    const userA = await registerUser(`trk_user_a_${timestamp}`);
    cleanupUserIds.push(userA.id);
    const userB = await registerUser(`trk_user_b_${timestamp}`);
    cleanupUserIds.push(userB.id);

    // Setup Demo User Token
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';
    const demoToken = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000001', username: 'demo' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Fetch catalog problems for testing
    const catRes = await pool.query(
      'SELECT id, lc_number, title, slug, difficulty FROM catalog_problems ORDER BY lc_number ASC LIMIT 10'
    );
    assert.ok(catRes.rows.length >= 5, 'Catalog problems must be available in catalog_problems table');
    const catalogProblems = catRes.rows;

    // ──────────────────────────────────────────────────────────────────────────
    // a. Non-admin cannot create tracker, preview/confirm sheet, approve, invite, remove; is_admin immutable
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test a: Non-admin permissions & is_admin immutability ---');

    // Non-admin cannot create a tracker -> 403
    const createNonAdmin = await req(
      '/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Non-Admin Tracker',
          per_day: 2,
          start_date: '2026-11-23',
        }),
      },
      userA.token
    );
    assert.strictEqual(createNonAdmin.status, 403, 'Non-admin creating tracker must return 403');

    // Admin creates tracker
    const createAdmin = await req(
      '/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Admin Main Tracker',
          per_day: 2,
          start_date: '2026-11-23',
          timezone: 'Asia/Kolkata',
        }),
      },
      admin.token
    );
    assert.strictEqual(createAdmin.status, 201, `Admin tracker creation failed: ${JSON.stringify(createAdmin.data)}`);
    const tracker1 = createAdmin.data;

    // Add userA as member to tracker1 so we can test member-non-admin vs non-member
    await pool.query(
      'INSERT INTO tracker_members (tracker_id, user_id, joined_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',
      [tracker1.id, userA.id]
    );

    // Member userA (non-admin) trying admin actions returns 403
    const previewNonAdmin = await req(
      `/trackers/${tracker1.id}/sheet/preview`,
      {
        method: 'POST',
        body: JSON.stringify({ csv: 'lc_number\n1' }),
      },
      userA.token
    );
    assert.strictEqual(previewNonAdmin.status, 403, 'Member non-admin on sheet preview must return 403');

    const confirmNonAdmin = await req(
      `/trackers/${tracker1.id}/sheet/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ csv: 'lc_number\n1' }),
      },
      userA.token
    );
    assert.strictEqual(confirmNonAdmin.status, 403, 'Member non-admin on sheet confirm must return 403');

    const inviteNonAdmin = await req(
      `/trackers/${tracker1.id}/invites`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: 7, maxUses: 5 }),
      },
      userA.token
    );
    assert.strictEqual(inviteNonAdmin.status, 403, 'Member non-admin on create invite must return 403');

    const removeNonAdmin = await req(
      `/trackers/${tracker1.id}/members/${userB.id}/remove`,
      { method: 'POST' },
      userA.token
    );
    assert.strictEqual(removeNonAdmin.status, 403, 'Member non-admin on remove member must return 403');

    // Verify is_admin cannot be set through register or profile update
    const regAdminAttempt = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: `hacker_${timestamp}`,
        password: 'Password123!',
        is_admin: true,
      }),
    });
    assert.strictEqual(regAdminAttempt.status, 201);
    const hackerId = regAdminAttempt.data.user.id;
    cleanupUserIds.push(hackerId);
    const { rows: hackerRows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [hackerId]);
    assert.strictEqual(hackerRows[0].is_admin, false, 'is_admin in DB must remain false despite registration field');

    const profileUpdateAttempt = await req(
      '/auth/me',
      {
        method: 'PUT',
        body: JSON.stringify({ is_admin: true }),
      },
      regAdminAttempt.data.token
    );
    assert.ok(profileUpdateAttempt.status === 404 || profileUpdateAttempt.status === 405);
    const { rows: hackerRows2 } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [hackerId]);
    assert.strictEqual(hackerRows2[0].is_admin, false, 'is_admin in DB must remain false');
    console.log('  ✅ Test a passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // b. Non-member gets 404 on every tracker route; member of tracker A cannot submit to tracker B
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test b: Non-member 404 & cross-tracker submission refusal ---');

    // userB is not a member of tracker1
    const nonMemberToday = await req(`/trackers/${tracker1.id}/today`, {}, userB.token);
    assert.strictEqual(nonMemberToday.status, 404, 'Non-member on /today must return 404');

    const nonMemberPending = await req(`/trackers/${tracker1.id}/pending`, {}, userB.token);
    assert.strictEqual(nonMemberPending.status, 404, 'Non-member on /pending must return 404');

    const nonMemberBoard = await req(`/trackers/${tracker1.id}/board`, {}, userB.token);
    assert.strictEqual(nonMemberBoard.status, 404, 'Non-member on /board must return 404');

    const nonMemberLeave = await req(`/trackers/${tracker1.id}/leave`, { method: 'DELETE' }, userB.token);
    assert.strictEqual(nonMemberLeave.status, 404, 'Non-member on /leave must return 404');

    // Create tracker 2 for userB
    const createTracker2 = await req(
      '/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Tracker 2',
          per_day: 1,
          start_date: '2026-11-23',
        }),
      },
      admin.token
    );
    const tracker2 = createTracker2.data;
    await pool.query(
      'INSERT INTO tracker_members (tracker_id, user_id, joined_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',
      [tracker2.id, userB.id]
    );

    // Put an assignment in tracker2
    const { rows: t2AssignRows } = await pool.query(
      `INSERT INTO tracker_assignments (tracker_id, assign_date, catalog_id)
       VALUES ($1, '2026-11-23', $2)
       RETURNING id`,
      [tracker2.id, catalogProblems[0].id]
    );
    const t2AssignmentId = t2AssignRows[0].id;

    // userA (member of tracker 1, not tracker 2) tries submitting to tracker2
    const crossSubmit = await req(
      `/trackers/${tracker2.id}/assignments/${t2AssignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          solutionUrl: 'https://leetcode.com/problems/two-sum/solutions/123/',
        }),
      },
      userA.token
    );
    assert.strictEqual(crossSubmit.status, 404, 'Submitting to tracker where not a member must return 404');
    console.log('  ✅ Test b passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // c. Join request: create, duplicate -> 409, cancel, reject then cooldown, approve adds member; invalid code identical
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test c: Join request lifecycle, cooldown, and invalid code ---');

    // User B requests to join Tracker 1
    const joinReq1 = await req(
      '/trackers/requests',
      {
        method: 'POST',
        body: JSON.stringify({
          publicCode: tracker1.public_code,
          message: 'Please let me in!',
        }),
      },
      userB.token
    );
    assert.strictEqual(joinReq1.status, 200);
    assert.strictEqual(joinReq1.data.message, 'If the tracker code is valid, your request has been submitted.');

    // Duplicate join request -> 409
    const dupJoinReq = await req(
      '/trackers/requests',
      {
        method: 'POST',
        body: JSON.stringify({
          publicCode: tracker1.public_code,
        }),
      },
      userB.token
    );
    assert.strictEqual(dupJoinReq.status, 409, 'Duplicate join request must return 409');

    // Get my pending requests
    const myReqs = await req('/trackers/my', {}, userB.token);
    assert.strictEqual(myReqs.status, 200);
    assert.ok(myReqs.data.pendingRequests.length > 0);
    const pendingReqId = myReqs.data.pendingRequests[0].id;

    // Cancel pending request
    const cancelReq = await req(`/trackers/requests/${pendingReqId}`, { method: 'DELETE' }, userB.token);
    assert.strictEqual(cancelReq.status, 200);

    // Request again after cancel succeeds
    const reRequest = await req(
      '/trackers/requests',
      {
        method: 'POST',
        body: JSON.stringify({ publicCode: tracker1.public_code }),
      },
      userB.token
    );
    assert.strictEqual(reRequest.status, 200);

    // Admin lists requests
    const adminReqs = await req(`/trackers/${tracker1.id}/requests`, {}, admin.token);
    assert.strictEqual(adminReqs.status, 200);
    const adminReq = adminReqs.data.find((r) => r.user_id === userB.id && r.status === 'pending');
    assert.ok(adminReq);

    // Admin rejects request
    const rejectReq = await req(
      `/trackers/${tracker1.id}/requests/${adminReq.id}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({ decision: 'reject' }),
      },
      admin.token
    );
    assert.strictEqual(rejectReq.status, 200);

    // User B tries to request again -> 429 Cooldown
    const cooldownReq = await req(
      '/trackers/requests',
      {
        method: 'POST',
        body: JSON.stringify({ publicCode: tracker1.public_code }),
      },
      userB.token
    );
    assert.strictEqual(cooldownReq.status, 429, 'Request during 24h cooldown must return 429');

    // Bypass cooldown in DB for testing approval
    await pool.query(
      `UPDATE tracker_join_requests
       SET decided_at = CURRENT_TIMESTAMP - INTERVAL '25 hours'
       WHERE id = $1`,
      [adminReq.id]
    );

    // User B requests again
    const reqAfterCooldown = await req(
      '/trackers/requests',
      {
        method: 'POST',
        body: JSON.stringify({ publicCode: tracker1.public_code }),
      },
      userB.token
    );
    assert.strictEqual(reqAfterCooldown.status, 200);

    // Admin approves request
    const adminReqs2 = await req(`/trackers/${tracker1.id}/requests`, {}, admin.token);
    const pendingToApprove = adminReqs2.data.find((r) => r.user_id === userB.id && r.status === 'pending');
    const approveRes = await req(
      `/trackers/${tracker1.id}/requests/${pendingToApprove.id}/decision`,
      {
        method: 'POST',
        body: JSON.stringify({ decision: 'approve' }),
      },
      admin.token
    );
    assert.strictEqual(approveRes.status, 200);

    // User B is now a member of Tracker 1
    const { rows: memCheck } = await pool.query(
      'SELECT 1 FROM tracker_members WHERE tracker_id = $1 AND user_id = $2',
      [tracker1.id, userB.id]
    );
    assert.strictEqual(memCheck.length, 1, 'Approved user must be added to tracker_members');

    // Invalid code response is identical to valid code response
    const invalidCodeRes = await req(
      '/trackers/requests',
      {
        method: 'POST',
        body: JSON.stringify({ publicCode: 'ZZZZZZZZ' }),
      },
      userA.token
    );
    assert.strictEqual(invalidCodeRes.status, 200);
    assert.strictEqual(invalidCodeRes.data.message, 'If the tracker code is valid, your request has been submitted.');
    console.log('  ✅ Test c passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // d. Invite: valid accept joins; expired, revoked, over-max-uses refused; plaintext not stored; accepting twice burns 1 use
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test d: Invite tokens, hashing, expiration, revocation, and use limits ---');

    // Remove userB from tracker1 so we can test invite accept
    await pool.query('DELETE FROM tracker_members WHERE tracker_id = $1 AND user_id = $2', [tracker1.id, userB.id]);

    // Admin creates invite with max_uses = 2
    const createInvRes = await req(
      `/trackers/${tracker1.id}/invites`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: 7, maxUses: 2 }),
      },
      admin.token
    );
    assert.strictEqual(createInvRes.status, 201);
    const rawToken = createInvRes.data.invite.token;
    const inviteId = createInvRes.data.invite.id;
    assert.ok(rawToken, 'Must return raw token once');

    // Verify token is NOT stored plaintext in DB
    const { rows: invRows } = await pool.query('SELECT * FROM tracker_invites WHERE id = $1', [inviteId]);
    assert.notStrictEqual(invRows[0].token_hash, rawToken, 'Plaintext token must NOT be stored in DB');
    assert.strictEqual(invRows[0].token_hash.length, 64, 'token_hash must be 64-char SHA-256');

    // User B accepts invite
    const accept1 = await req('/trackers/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token: rawToken }),
    }, userB.token);
    assert.strictEqual(accept1.status, 200);

    const { rows: invCheck1 } = await pool.query('SELECT use_count FROM tracker_invites WHERE id = $1', [inviteId]);
    assert.strictEqual(invCheck1[0].use_count, 1, 'use_count should increment to 1');

    // User B accepts again (idempotent, burns no extra use)
    const acceptAgain = await req('/trackers/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token: rawToken }),
    }, userB.token);
    assert.strictEqual(acceptAgain.status, 200);
    const { rows: invCheck2 } = await pool.query('SELECT use_count FROM tracker_invites WHERE id = $1', [inviteId]);
    assert.strictEqual(invCheck2[0].use_count, 1, 'use_count must remain 1 for existing member');

    // Test revoked invite
    const revokeRes = await req(`/trackers/${tracker1.id}/invites/${inviteId}`, { method: 'DELETE' }, admin.token);
    assert.strictEqual(revokeRes.status, 200);

    const userC = await registerUser(`trk_user_c_${timestamp}`);
    cleanupUserIds.push(userC.id);
    const acceptRevoked = await req('/trackers/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token: rawToken }),
    }, userC.token);
    assert.strictEqual(acceptRevoked.status, 410, 'Revoked invite must be refused with 410');

    // Test expired invite
    const createExpInv = await req(
      `/trackers/${tracker1.id}/invites`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: -1, maxUses: 5 }),
      },
      admin.token
    );
    const expToken = createExpInv.data.invite.token;
    const acceptExpired = await req('/trackers/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token: expToken }),
    }, userC.token);
    assert.strictEqual(acceptExpired.status, 410, 'Expired invite must be refused with 410');

    // Test max uses
    const createLimitedInv = await req(
      `/trackers/${tracker1.id}/invites`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: 7, maxUses: 1 }),
      },
      admin.token
    );
    const limitToken = createLimitedInv.data.invite.token;
    const acceptLimit1 = await req('/trackers/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token: limitToken }),
    }, userC.token);
    assert.strictEqual(acceptLimit1.status, 200);

    const userD = await registerUser(`trk_user_d_${timestamp}`);
    cleanupUserIds.push(userD.id);
    const acceptLimit2 = await req('/trackers/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ token: limitToken }),
    }, userD.token);
    assert.strictEqual(acceptLimit2.status, 410, 'Invite exceeding max uses must be refused with 410');
    console.log('  ✅ Test d passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // e. Two concurrent approvals of one request produce one membership
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test e: Two concurrent approvals of one request produce one membership ---');

    // Clean up User C's membership from tracker 1
    await pool.query('DELETE FROM tracker_members WHERE tracker_id = $1 AND user_id = $2', [tracker1.id, userC.id]);

    // User C submits request
    const { rows: concReqRows } = await pool.query(
      `INSERT INTO tracker_join_requests (tracker_id, user_id, message, status)
       VALUES ($1, $2, 'Concurrent test', 'pending')
       RETURNING id`,
      [tracker1.id, userC.id]
    );
    const concReqId = concReqRows[0].id;

    // Approve concurrently in parallel
    const [cRes1, cRes2] = await Promise.all([
      req(`/trackers/${tracker1.id}/requests/${concReqId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'approve' }),
      }, admin.token),
      req(`/trackers/${tracker1.id}/requests/${concReqId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'approve' }),
      }, admin.token),
    ]);

    // One succeeds (200), one conflicts (409)
    const successCount = [cRes1.status, cRes2.status].filter((s) => s === 200).length;
    assert.strictEqual(successCount, 1, 'Exactly one concurrent approval should return 200');

    const { rows: memCountRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_members WHERE tracker_id = $1 AND user_id = $2',
      [tracker1.id, userC.id]
    );
    assert.strictEqual(memCountRows[0].count, 1, 'Concurrent approvals must yield exactly one membership');
    console.log('  ✅ Test e passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // f. CSV preview: valid file, unknown numbers, duplicate numbers, missing column -> 400, >1000 rows -> 400; confirm rejects unknown numbers & preserves past assignments
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test f: CSV preview, confirmation, and past assignment preservation ---');

    // Valid CSV
    const validCsv = `lc_number,position\n${catalogProblems[0].lc_number},1\n${catalogProblems[1].lc_number},2\n${catalogProblems[2].lc_number},3`;
    const previewRes = await req(
      `/trackers/${tracker1.id}/sheet/preview`,
      { method: 'POST', body: JSON.stringify({ csv: validCsv }) },
      admin.token
    );
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.data.valid, 3);
    assert.strictEqual(previewRes.data.unknown.length, 0);
    assert.strictEqual(previewRes.data.duplicates.length, 0);
    assert.strictEqual(previewRes.data.firstTen.length, 3);

    // Verify preview writes NOTHING to DB
    const { rows: sheetBefore } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_sheet_items WHERE tracker_id = $1',
      [tracker1.id]
    );
    assert.strictEqual(sheetBefore[0].count, 0, 'Preview must not write anything to DB');

    // Unknown numbers in CSV
    const unknownCsv = `lc_number\n99999998\n${catalogProblems[0].lc_number}`;
    const previewUnknown = await req(
      `/trackers/${tracker1.id}/sheet/preview`,
      { method: 'POST', body: JSON.stringify({ csv: unknownCsv }) },
      admin.token
    );
    assert.strictEqual(previewUnknown.status, 200);
    assert.ok(previewUnknown.data.unknown.includes(99999998), 'Unknown numbers must be reported in preview');

    // Duplicate numbers in CSV
    const dupCsv = `lc_number\n${catalogProblems[0].lc_number}\n${catalogProblems[0].lc_number}`;
    const previewDup = await req(
      `/trackers/${tracker1.id}/sheet/preview`,
      { method: 'POST', body: JSON.stringify({ csv: dupCsv }) },
      admin.token
    );
    assert.strictEqual(previewDup.status, 200);
    assert.ok(previewDup.data.duplicates.includes(catalogProblems[0].lc_number), 'Duplicates must be reported');

    // Missing lc_number column -> 400
    const missingColCsv = 'problem_id,position\n1,1';
    const previewMissingCol = await req(
      `/trackers/${tracker1.id}/sheet/preview`,
      { method: 'POST', body: JSON.stringify({ csv: missingColCsv }) },
      admin.token
    );
    assert.strictEqual(previewMissingCol.status, 400, 'Missing lc_number column must return 400');

    // > 1000 rows -> 400
    const longCsv = 'lc_number\n' + Array(1005).fill('1').join('\n');
    const previewTooLong = await req(
      `/trackers/${tracker1.id}/sheet/preview`,
      { method: 'POST', body: JSON.stringify({ csv: longCsv }) },
      admin.token
    );
    assert.strictEqual(previewTooLong.status, 400, '>1000 rows must return 400');

    // Confirm rejects a file with unknown numbers
    const confirmUnknown = await req(
      `/trackers/${tracker1.id}/sheet/confirm`,
      { method: 'POST', body: JSON.stringify({ csv: unknownCsv }) },
      admin.token
    );
    assert.strictEqual(confirmUnknown.status, 400, 'Confirm must reject CSV with unknown numbers');

    // Confirm valid sheet
    const confirmValid = await req(
      `/trackers/${tracker1.id}/sheet/confirm`,
      { method: 'POST', body: JSON.stringify({ csv: validCsv }) },
      admin.token
    );
    assert.strictEqual(confirmValid.status, 200);

    // Create a past assignment for tracker 1
    const { rows: pastAssignRows } = await pool.query(
      `INSERT INTO tracker_assignments (tracker_id, assign_date, catalog_id)
       VALUES ($1, '2026-11-20', $2)
       RETURNING id`,
      [tracker1.id, catalogProblems[0].id]
    );
    const pastAssignmentId = pastAssignRows[0].id;

    // Confirm a new sheet with different problems
    const newSheetCsv = `lc_number,position\n${catalogProblems[1].lc_number},1\n${catalogProblems[2].lc_number},2\n${catalogProblems[3].lc_number},3`;
    const confirmNewSheet = await req(
      `/trackers/${tracker1.id}/sheet/confirm`,
      { method: 'POST', body: JSON.stringify({ csv: newSheetCsv }) },
      admin.token
    );
    assert.strictEqual(confirmNewSheet.status, 200);

    // Verify past assignment was NOT altered
    const { rows: verifyPast } = await pool.query(
      'SELECT id FROM tracker_assignments WHERE id = $1',
      [pastAssignmentId]
    );
    assert.strictEqual(verifyPast.length, 1, 'Past assignments must remain intact after sheet update');
    console.log('  ✅ Test f passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // g. Empty sheet: /today returns sheetEmpty and creates no assignments
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test g: Empty sheet returns sheetEmpty and creates no assignments ---');

    const emptyTrackerRes = await req(
      '/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Empty Sheet Tracker',
          per_day: 2,
          start_date: '2026-11-23',
        }),
      },
      admin.token
    );
    const emptyTracker = emptyTrackerRes.data;

    const todayEmptyRes = await req(`/trackers/${emptyTracker.id}/today`, {}, admin.token);
    assert.strictEqual(todayEmptyRes.status, 200);
    assert.strictEqual(todayEmptyRes.data.sheetEmpty, true, '/today must return sheetEmpty: true');

    const { rows: emptyAssignCount } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_assignments WHERE tracker_id = $1',
      [emptyTracker.id]
    );
    assert.strictEqual(emptyAssignCount[0].count, 0, 'No assignments should be created for empty sheet');
    console.log('  ✅ Test g passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // h. Backfill: last generated date 3 days back -> 3 days created, no duplicates; 10 parallel /today calls create no duplicates
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test h: Backfill generation & 10 parallel /today concurrency ---');

    const todayStr = getTodayInTimezone('Asia/Kolkata');
    const threeDaysAgoStr = addDaysString(todayStr, -2); // 3 days: today - 2, today - 1, today

    const backfillTrackerRes = await req(
      '/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Backfill Tracker',
          per_day: 1,
          start_date: threeDaysAgoStr,
          timezone: 'Asia/Kolkata',
        }),
      },
      admin.token
    );
    const backfillTracker = backfillTrackerRes.data;

    // Upload 5 problems into sheet
    const backfillCsv = catalogProblems
      .slice(0, 5)
      .map((p, idx) => `${p.lc_number},${idx + 1}`)
      .join('\n');
    await req(
      `/trackers/${backfillTracker.id}/sheet/confirm`,
      { method: 'POST', body: JSON.stringify({ csv: `lc_number,position\n${backfillCsv}` }) },
      admin.token
    );

    // Call /today: should backfill 3 days (3 assignments)
    const bfToday = await req(`/trackers/${backfillTracker.id}/today`, {}, admin.token);
    assert.strictEqual(bfToday.status, 200);

    const { rows: bfAssigns } = await pool.query(
      'SELECT assign_date::text AS assign_date, catalog_id FROM tracker_assignments WHERE tracker_id = $1 ORDER BY assign_date ASC',
      [backfillTracker.id]
    );
    assert.strictEqual(bfAssigns.length, 3, 'Backfill should create exactly 3 days of assignments');
    assert.strictEqual(bfAssigns[0].assign_date, threeDaysAgoStr);
    assert.strictEqual(bfAssigns[2].assign_date, todayStr);

    // Concurrency test: 10 parallel /today calls
    const parallelResponses = await Promise.all(
      Array.from({ length: 10 }, () => req(`/trackers/${backfillTracker.id}/today`, {}, admin.token))
    );
    for (const r of parallelResponses) {
      assert.strictEqual(r.status, 200);
    }

    const { rows: bfAssignsAfterParallel } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_assignments WHERE tracker_id = $1',
      [backfillTracker.id]
    );
    assert.strictEqual(bfAssignsAfterParallel[0].count, 3, '10 parallel /today calls must produce zero duplicates');
    console.log('  ✅ Test h passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // i. Pending derived correctly; submitting removes it; late joiner has no pending before joined_at
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test i: Pending derivation & late joiner isolation ---');

    // Admin joined on start_date (threeDaysAgoStr).
    // Assignments exist for: threeDaysAgoStr (pending), yesterday (pending), today (current, not pending).
    const pendingRes = await req(`/trackers/${backfillTracker.id}/pending`, {}, admin.token);
    assert.strictEqual(pendingRes.status, 200);
    assert.strictEqual(pendingRes.data.pending.length, 2, 'Should have 2 pending assignments from past days');

    const firstPending = pendingRes.data.pending[0];

    // Submit for the first pending assignment
    const submitPending = await req(
      `/trackers/${backfillTracker.id}/assignments/${firstPending.assignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          solutionUrl: 'https://leetcode.com/problems/test/solutions/1/',
          timeTaken: 15,
        }),
      },
      admin.token
    );
    assert.strictEqual(submitPending.status, 201);

    // Check pending again: count should now be 1
    const pendingResAfter = await req(`/trackers/${backfillTracker.id}/pending`, {}, admin.token);
    assert.strictEqual(pendingResAfter.data.pending.length, 1, 'Submitting should remove assignment from pending');

    // Late joiner User D joins today
    await pool.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING`,
      [backfillTracker.id, userD.id]
    );

    // User D should have 0 pending because they joined today!
    const lateJoinerPending = await req(`/trackers/${backfillTracker.id}/pending`, {}, userD.token);
    assert.strictEqual(lateJoinerPending.status, 200);
    assert.strictEqual(lateJoinerPending.data.pending.length, 0, 'Late joiner must have no pending before joined_at');
    console.log('  ✅ Test i passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // j. Second submit -> 409; submission creates or reuses exactly one problems row for that user
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test j: Duplicate submit 409 & vault problems row creation/reuse ---');

    // Re-submit the same assignment -> 409 ALREADY_SUBMITTED
    const secondSubmit = await req(
      `/trackers/${backfillTracker.id}/assignments/${firstPending.assignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          solutionUrl: 'https://leetcode.com/problems/test/solutions/2/',
        }),
      },
      admin.token
    );
    assert.strictEqual(secondSubmit.status, 409, 'Second submit must return 409');
    assert.strictEqual(secondSubmit.data.error, 'ALREADY_SUBMITTED');

    // Verify vault problems row created
    const { rows: vaultProbs } = await pool.query(
      'SELECT id FROM problems WHERE user_id = $1 AND catalog_id = $2',
      [admin.id, firstPending.catalogId]
    );
    assert.strictEqual(vaultProbs.length, 1, 'Exactly one vault problems row must exist for this catalog problem');
    const existingVaultProbId = vaultProbs[0].id;

    // If another tracker assigns the exact same catalogId and user submits:
    // Create an assignment in Tracker 2 with the same catalogId
    const { rows: t2ReuseAssign } = await pool.query(
      `INSERT INTO tracker_assignments (tracker_id, assign_date, catalog_id)
       VALUES ($1, '2026-11-24', $2)
       ON CONFLICT (tracker_id, assign_date, catalog_id) DO UPDATE SET catalog_id = EXCLUDED.catalog_id
       RETURNING id`,
      [tracker2.id, firstPending.catalogId]
    );
    // Add admin as member to tracker 2
    await pool.query(
      'INSERT INTO tracker_members (tracker_id, user_id, joined_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',
      [tracker2.id, admin.id]
    );

    const submitReuse = await req(
      `/trackers/${tracker2.id}/assignments/${t2ReuseAssign[0].id}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          solutionUrl: 'https://leetcode.com/problems/test/solutions/3/',
        }),
      },
      admin.token
    );
    assert.strictEqual(submitReuse.status, 201);
    assert.strictEqual(submitReuse.data.submission.problem_id, existingVaultProbId, 'Must reuse existing vault problem row');

    const { rows: vaultProbsAfter } = await pool.query(
      'SELECT id FROM problems WHERE user_id = $1 AND catalog_id = $2',
      [admin.id, firstPending.catalogId]
    );
    assert.strictEqual(vaultProbsAfter.length, 1, 'Still exactly one vault problems row after reuse');
    console.log('  ✅ Test j passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // k. Sheet exhaustion returns sheetComplete; per_day change leaves past assignments unchanged
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test k: Sheet exhaustion (sheetComplete) & settings update safety ---');

    const exhaustTrackerRes = await req(
      '/trackers',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Exhaust Tracker',
          per_day: 2,
          start_date: todayStr,
        }),
      },
      admin.token
    );
    const exhaustTracker = exhaustTrackerRes.data;

    // Sheet has only 1 problem
    const exhaustCsv = `lc_number,position\n${catalogProblems[0].lc_number},1`;
    await req(
      `/trackers/${exhaustTracker.id}/sheet/confirm`,
      { method: 'POST', body: JSON.stringify({ csv: exhaustCsv }) },
      admin.token
    );

    // Call /today -> sheet runs out immediately -> returns sheetComplete: true
    const exhaustToday = await req(`/trackers/${exhaustTracker.id}/today`, {}, admin.token);
    assert.strictEqual(exhaustToday.status, 200);
    assert.strictEqual(exhaustToday.data.sheetComplete, true, 'Sheet exhaustion must return sheetComplete: true');

    // Update per_day via settings
    const updateSettings = await req(
      `/trackers/${exhaustTracker.id}/settings`,
      {
        method: 'PUT',
        body: JSON.stringify({ per_day: 5 }),
      },
      admin.token
    );
    assert.strictEqual(updateSettings.status, 200);
    assert.strictEqual(updateSettings.data.per_day, 5);

    // Verify past assignments for exhaustTracker were unchanged
    const { rows: assignsAfterSettings } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_assignments WHERE tracker_id = $1',
      [exhaustTracker.id]
    );
    assert.strictEqual(assignsAfterSettings[0].count, 1, 'Past assignments must remain unchanged after per_day change');
    console.log('  ✅ Test k passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // l. Timezone rollover: 23:59 vs 00:01 tracker time lands on the right date
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test l: Timezone rollover boundary ---');

    // In America/New_York (UTC-5):
    // UTC 2026-11-23 04:59:00 is 2026-11-22 23:59:00
    // UTC 2026-11-23 05:01:00 is 2026-11-23 00:01:00
    const d2359 = new Date('2026-11-23T04:59:00Z');
    const d0001 = new Date('2026-11-23T05:01:00Z');

    const nyDate2359 = getTodayInTimezone('America/New_York', d2359);
    const nyDate0001 = getTodayInTimezone('America/New_York', d0001);

    assert.strictEqual(nyDate2359, '2026-11-22', '23:59 NY time should be 2026-11-22');
    assert.strictEqual(nyDate0001, '2026-11-23', '00:01 NY time should be 2026-11-23');
    console.log('  ✅ Test l passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // m. Demo user cannot request, accept an invite, or submit; javascript: solutionUrl -> 400
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test m: Demo user restrictions & javascript: url rejection ---');

    // Demo user cannot submit join request
    const demoReq = await req(
      '/trackers/requests',
      {
        method: 'POST',
        body: JSON.stringify({ publicCode: tracker1.public_code }),
      },
      demoToken
    );
    assert.strictEqual(demoReq.status, 403, 'Demo user requesting join must return 403');

    // Demo user cannot accept invite
    const demoAccept = await req(
      '/trackers/invites/accept',
      {
        method: 'POST',
        body: JSON.stringify({ token: 'dummy_token' }),
      },
      demoToken
    );
    assert.strictEqual(demoAccept.status, 403, 'Demo user accepting invite must return 403');

    // Demo user cannot submit solution
    const demoSubmit = await req(
      `/trackers/${tracker1.id}/assignments/${pastAssignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({ solutionUrl: 'https://leetcode.com/solution' }),
      },
      demoToken
    );
    assert.strictEqual(demoSubmit.status, 403, 'Demo user submitting solution must return 403');

    // javascript: solutionUrl -> 400 INVALID_URL
    const jsSubmit = await req(
      `/trackers/${tracker1.id}/assignments/${pastAssignmentId}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({
          solutionUrl: 'javascript:alert(1)',
        }),
      },
      admin.token
    );
    assert.strictEqual(jsSubmit.status, 400, 'javascript: solutionUrl must be rejected with 400');
    assert.strictEqual(jsSubmit.data.error, 'INVALID_URL');
    console.log('  ✅ Test m passed.');

    // ──────────────────────────────────────────────────────────────────────────
    // n. Backend additions: isAdmin in auth responses, GET /trackers/:id, GET /invites, GET /members
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- Test n: Backend additions (isAdmin flag, tracker details, invites list, members list) ---');

    // 1. /api/auth/me and login responses include isAdmin
    const adminMe = await req('/auth/me', {}, admin.token);
    assert.strictEqual(adminMe.status, 200);
    assert.strictEqual(adminMe.data.user.isAdmin, true, 'Admin /auth/me should have isAdmin: true');

    const userAMe = await req('/auth/me', {}, userA.token);
    assert.strictEqual(userAMe.status, 200);
    assert.strictEqual(userAMe.data.user.isAdmin, false, 'Normal user /auth/me should have isAdmin: false');

    const adminLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: admin.username, password: 'Password123!' }),
    });
    assert.strictEqual(adminLogin.status, 200);
    assert.strictEqual(adminLogin.data.user.isAdmin, true, 'Admin login response should have isAdmin: true');

    const userALogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: userA.username, password: 'Password123!' }),
    });
    assert.strictEqual(userALogin.status, 200);
    assert.strictEqual(userALogin.data.user.isAdmin, false, 'Normal user login response should have isAdmin: false');

    // 2. GET /api/trackers/:id (member only)
    const trackerDetailUserA = await req(`/trackers/${tracker1.id}`, {}, userA.token);
    assert.strictEqual(trackerDetailUserA.status, 200);
    assert.strictEqual(trackerDetailUserA.data.name, tracker1.name);
    assert.strictEqual(trackerDetailUserA.data.timezone, 'Asia/Kolkata');
    assert.strictEqual(trackerDetailUserA.data.perDay, tracker1.per_day);
    assert.ok(['empty', 'inProgress', 'complete'].includes(trackerDetailUserA.data.sheetStatus));
    assert.strictEqual(trackerDetailUserA.data.publicCode, undefined, 'Non-admin member should not see publicCode');

    const trackerDetailAdmin = await req(`/trackers/${tracker1.id}`, {}, admin.token);
    assert.strictEqual(trackerDetailAdmin.status, 200);
    assert.strictEqual(trackerDetailAdmin.data.publicCode, tracker1.public_code, 'Admin member should see publicCode');

    // Non-member gets 404
    const trackerDetailNonMember = await req(`/trackers/${tracker1.id}`, {}, userD.token);
    assert.strictEqual(trackerDetailNonMember.status, 404, 'Non-member should get 404 on GET /trackers/:id');

    // 3. GET /api/trackers/:id/invites (admin only)
    const listInvitesAdmin = await req(`/trackers/${tracker1.id}/invites`, {}, admin.token);
    assert.strictEqual(listInvitesAdmin.status, 200);
    assert.ok(Array.isArray(listInvitesAdmin.data));
    if (listInvitesAdmin.data.length > 0) {
      const inv = listInvitesAdmin.data[0];
      assert.ok('id' in inv);
      assert.ok('expiresAt' in inv);
      assert.ok('maxUses' in inv);
      assert.ok('useCount' in inv);
      assert.ok('revoked' in inv);
      assert.strictEqual(inv.token, undefined, 'NEVER return token in invite listing');
      assert.strictEqual(inv.token_hash, undefined, 'NEVER return token_hash in invite listing');
    }

    // Non-admin member gets 403 on GET /invites
    const listInvitesUserA = await req(`/trackers/${tracker1.id}/invites`, {}, userA.token);
    assert.strictEqual(listInvitesUserA.status, 403, 'Non-admin member should get 403 on GET /invites');

    // Non-member gets 404 on GET /invites
    const listInvitesNonMember = await req(`/trackers/${tracker1.id}/invites`, {}, userD.token);
    assert.strictEqual(listInvitesNonMember.status, 404, 'Non-member should get 404 on GET /invites');

    // 4. GET /api/trackers/:id/members (member only)
    const listMembersUserA = await req(`/trackers/${tracker1.id}/members`, {}, userA.token);
    assert.strictEqual(listMembersUserA.status, 200);
    assert.ok(Array.isArray(listMembersUserA.data));
    assert.ok(listMembersUserA.data.length >= 2, 'Tracker 1 should have members');
    const firstMember = listMembersUserA.data[0];
    assert.ok('userId' in firstMember);
    assert.ok('username' in firstMember);
    assert.ok('joinedAt' in firstMember);

    // Non-member gets 404 on GET /members
    const listMembersNonMember = await req(`/trackers/${tracker1.id}/members`, {}, userD.token);
    assert.strictEqual(listMembersNonMember.status, 404, 'Non-member should get 404 on GET /members');
    console.log('  ✅ Test n passed.');

    console.log('\n🎉 ALL TRACKERS TESTS (a through n) PASSED SUCCESSFULLY!\n');
  } finally {
    // Clean up created test users
    if (cleanupUserIds.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [cleanupUserIds]).catch(() => {});
    }
    if (localServer) {
      await new Promise((resolve) => localServer.close(resolve));
    }
  }
}

runTrackersTests()
  .then(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Trackers Test Failed:', err);
    if (localServer) {
      localServer.close();
    }
    await pool.end().catch(() => {});
    process.exit(1);
  });
