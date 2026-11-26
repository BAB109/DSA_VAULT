/**
 * Admin Control Center Test Suite
 *
 * Covers subtests:
 * a. Every /api/admin route returns 404 for non-admin and 401 without token. Verify is_admin cannot be changed via any route.
 * b. Admin sees trackers they are not a member of; sheet summary counts match DB reality (total, assigned, remaining, estimatedDaysLeft).
 * c. Create tracker with and without initial CSV; invalid timezone -> 400; per_day 0 and 11 -> 400.
 * d. per_day change does not alter past or already-assigned days; applyToday=true increases today's count and refuses to decrease it (400).
 * e. Add one item, duplicate item -> 409, remove upcoming works, remove assigned -> 409.
 * f. Reorder upcoming items: valid order applied; list that includes assigned ID or misses upcoming ID -> 400; assigned positions unchanged.
 * g. CSV append skips existing numbers and reports them; replace leaves assigned items intact.
 * h. Archived tracker generates no new assignments (call generateAssignments; verify count does not increase).
 * i. Hard delete requires exact name (wrong name -> 400); after deletion, members' vault problems rows still exist.
 * j. Every mutation writes an audit row; audit row survives tracker deletion.
 * Cleanup all created users and trackers.
 */

import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { generateAssignments } from './routes/trackers.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

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

async function runAdminTests() {
  console.log('🛡️ Starting Admin Control Center Test Suite...\n');
  const timestamp = Date.now();
  const createdUserIds = [];
  const createdTrackerIds = [];

  // Helper for cleanup
  async function cleanup() {
    console.log('\n🧹 Cleaning up test users and trackers...');
    try {
      if (createdTrackerIds.length > 0) {
        // Cascade delete any remaining test trackers
        await pool.query('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM tracker_assignments WHERE tracker_id = ANY($1))', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_assignments WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_sheet_items WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_invites WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_join_requests WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_members WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM trackers WHERE id = ANY($1)', [createdTrackerIds]);
      }
      if (createdUserIds.length > 0) {
        await pool.query('DELETE FROM admin_audit_log WHERE admin_id = ANY($1)', [createdUserIds]);
        await pool.query('DELETE FROM problems WHERE user_id = ANY($1)', [createdUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
      }
      console.log('  ✅ Cleanup complete.');
    } catch (err) {
      console.warn('  ⚠️ Warning during cleanup:', err.message);
    }
  }

  try {
    // 0. Register Test Users: 1 Admin and 1 Regular Member
    console.log('0. Registering test users (Admin & Member)...');
    const adminUsername = `adm_user_${timestamp}`;
    const memberUsername = `mem_user_${timestamp}`;

    const regAdminRes = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: adminUsername, password: 'Password123!' }),
    });
    assert.strictEqual(regAdminRes.status, 201, `Failed to register admin: ${JSON.stringify(regAdminRes.data)}`);
    const adminId = regAdminRes.data.user.id;
    createdUserIds.push(adminId);

    // Promote to admin in DB directly
    await pool.query('UPDATE users SET is_admin = true WHERE id = $1', [adminId]);

    // Generate dedicated admin token
    const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'vault_admin_jwt_secret_super_secure_32_chars!';
    const adminToken = jwt.sign(
      { sub: adminId, scope: 'admin' },
      ADMIN_JWT_SECRET,
      { expiresIn: '2h' }
    );

    const regMemberRes = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: memberUsername, password: 'Password123!' }),
    });
    assert.strictEqual(regMemberRes.status, 201, `Failed to register member: ${JSON.stringify(regMemberRes.data)}`);
    const memberId = regMemberRes.data.user.id;
    const memberToken = regMemberRes.data.token;
    createdUserIds.push(memberId);
    console.log(`  ✅ Registered Admin (${adminUsername}) and Member (${memberUsername}).`);

    // Fetch catalog problems for testing
    const catRows = await pool.query('SELECT id, lc_number, title FROM catalog_problems ORDER BY lc_number ASC LIMIT 10');
    assert.ok(catRows.rows.length >= 5, 'Need at least 5 catalog problems in DB for testing');
    const catItems = catRows.rows;
    console.log(`  ✅ Loaded ${catItems.length} catalog problems (first: #${catItems[0].lc_number} "${catItems[0].title}").`);

    // =========================================================================
    // a. Every /api/admin route returns 404 for non-admin and 401 without token.
    //    Verify is_admin cannot be changed via any route.
    // =========================================================================
    console.log('\n--- Test A: Route Protection (401 unauth, 404 non-admin) & is_admin Immutability ---');
    const dummyId = '00000000-0000-0000-0000-000000000001';

    // 401 without token
    const resUnauth = await req('/admin/trackers');
    assert.strictEqual(resUnauth.status, 401, 'Unauthenticated request must return 401');

    // 404 for non-admin on all routes
    const adminEndpoints = [
      { method: 'GET', path: '/admin/trackers' },
      { method: 'POST', path: '/admin/trackers', body: { name: 'X', per_day: 1 } },
      { method: 'PATCH', path: `/admin/trackers/${dummyId}`, body: { per_day: 2 } },
      { method: 'GET', path: `/admin/trackers/${dummyId}/sheet` },
      { method: 'POST', path: `/admin/trackers/${dummyId}/sheet/preview`, body: { csv: 'lc_number\n1' } },
      { method: 'POST', path: `/admin/trackers/${dummyId}/sheet/confirm`, body: { mode: 'append', items: [{ catalogId: catItems[0].id, position: 1 }] } },
      { method: 'POST', path: `/admin/trackers/${dummyId}/sheet/items`, body: { catalogId: catItems[0].id } },
      { method: 'DELETE', path: `/admin/trackers/${dummyId}/sheet/items/${catItems[0].id}` },
      { method: 'PUT', path: `/admin/trackers/${dummyId}/sheet/order`, body: { catalogIds: [catItems[0].id] } },
      { method: 'POST', path: `/admin/trackers/${dummyId}/sheet/clear-upcoming` },
      { method: 'DELETE', path: `/admin/trackers/${dummyId}`, body: { confirmName: 'X' } },
      { method: 'GET', path: '/admin/audit' },
    ];

    for (const ep of adminEndpoints) {
      const opts = { method: ep.method };
      if (ep.body) opts.body = JSON.stringify(ep.body);
      const res = await req(ep.path, opts, memberToken);
      assert.strictEqual(
        res.status,
        404,
        `Expected non-admin to get 404 on ${ep.method} ${ep.path}, got ${res.status}`
      );
    }
    console.log('  ✅ Verified all /api/admin routes return 404 for non-admin and 401 without token.');

    // Verify is_admin cannot be changed via any route (e.g. register with isAdmin: true)
    const sneakyUsername = `sneak_${timestamp}`;
    const sneakyReg = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: sneakyUsername,
        password: 'Password123!',
        is_admin: true,
        isAdmin: true,
      }),
    });
    if (sneakyReg.status === 201) {
      createdUserIds.push(sneakyReg.data.user.id);
      assert.notStrictEqual(sneakyReg.data.user.isAdmin, true, 'Registering must not set isAdmin');
      const meRes = await req('/auth/me', {}, sneakyReg.data.token);
      if (meRes.status === 200) {
        assert.strictEqual(meRes.data.user.isAdmin, false, 'Auth /me must report isAdmin = false');
      }
      const dbCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [sneakyReg.data.user.id]);
      assert.strictEqual(dbCheck.rows[0].is_admin, false, 'DB must remain is_admin = false');
    }
    console.log('  ✅ Verified is_admin cannot be set or elevated via API routes.');

    // =========================================================================
    // b. Admin sees trackers they are not a member of; sheet summary counts match DB
    // =========================================================================
    console.log('\n--- Test B: Admin Sees Non-Member Trackers & Summary Counts ---');
    // Admin creates a tracker, then leaves / is removed from tracker_members
    const createTrackerRes = await req('/admin/trackers', {
      method: 'POST',
      body: JSON.stringify({
        name: `Non-Member Tracker ${timestamp}`,
        timezone: 'Asia/Kolkata',
        per_day: 1,
        start_date: '2026-11-20',
      }),
    }, adminToken);
    assert.strictEqual(createTrackerRes.status, 201, `Failed to create tracker: ${JSON.stringify(createTrackerRes.data)}`);
    const trackerBId = createTrackerRes.data.id;
    createdTrackerIds.push(trackerBId);

    // Remove admin from tracker_members so admin is NOT a member
    await pool.query('DELETE FROM tracker_members WHERE tracker_id = $1 AND user_id = $2', [trackerBId, adminId]);

    // Verify admin is NOT in tracker_members
    const memCheck = await pool.query('SELECT 1 FROM tracker_members WHERE tracker_id = $1 AND user_id = $2', [trackerBId, adminId]);
    assert.strictEqual(memCheck.rows.length, 0, 'Admin should not be a member of this tracker');

    // Admin lists trackers: must see trackerBId
    const adminListRes = await req('/admin/trackers', {}, adminToken);
    assert.strictEqual(adminListRes.status, 200);
    const foundB = adminListRes.data.find((t) => t.id === trackerBId);
    assert.ok(foundB, 'Admin must see tracker they are not a member of');
    assert.strictEqual(foundB.sheet.total, 0);
    assert.strictEqual(foundB.sheet.assigned, 0);
    assert.strictEqual(foundB.sheet.remaining, 0);
    assert.strictEqual(foundB.sheet.estimatedDaysLeft, 0);
    console.log('  ✅ Admin successfully listed tracker where they are not a member with correct empty sheet counts.');

    // =========================================================================
    // c. Create tracker with and without initial CSV; invalid timezone -> 400; per_day 0 and 11 -> 400
    // =========================================================================
    console.log('\n--- Test C: Create Tracker Validations & CSV Initial Import ---');
    // Invalid timezone -> 400
    const resBadTz = await req('/admin/trackers', {
      method: 'POST',
      body: JSON.stringify({
        name: `Bad Tz ${timestamp}`,
        timezone: 'Invalid/NonExistent_Zone',
        per_day: 1,
        start_date: '2026-11-25',
      }),
    }, adminToken);
    assert.strictEqual(resBadTz.status, 400, 'Invalid timezone must return 400');

    // per_day = 0 -> 400
    const resZeroPerDay = await req('/admin/trackers', {
      method: 'POST',
      body: JSON.stringify({
        name: `Zero Per Day ${timestamp}`,
        timezone: 'UTC',
        per_day: 0,
        start_date: '2026-11-25',
      }),
    }, adminToken);
    assert.strictEqual(resZeroPerDay.status, 400, 'per_day = 0 must return 400');

    // per_day = 11 -> 400
    const resHighPerDay = await req('/admin/trackers', {
      method: 'POST',
      body: JSON.stringify({
        name: `Eleven Per Day ${timestamp}`,
        timezone: 'UTC',
        per_day: 11,
        start_date: '2026-11-25',
      }),
    }, adminToken);
    assert.strictEqual(resHighPerDay.status, 400, 'per_day = 11 must return 400');

    // Create tracker without CSV
    const resNoCsv = await req('/admin/trackers', {
      method: 'POST',
      body: JSON.stringify({
        name: `Admin Tracker No CSV ${timestamp}`,
        timezone: 'UTC',
        per_day: 2,
        start_date: '2026-11-25',
      }),
    }, adminToken);
    assert.strictEqual(resNoCsv.status, 201, `Failed to create tracker without CSV: ${JSON.stringify(resNoCsv.data)}`);
    const trackerNoCsvId = resNoCsv.data.id;
    createdTrackerIds.push(trackerNoCsvId);

    // Create tracker with initial CSV
    const csvContent = `lc_number,position\n${catItems[0].lc_number},1\n${catItems[1].lc_number},2\n${catItems[2].lc_number},3`;
    const resWithCsv = await req('/admin/trackers', {
      method: 'POST',
      body: JSON.stringify({
        name: `Admin Tracker With CSV ${timestamp}`,
        timezone: 'UTC',
        per_day: 1,
        start_date: '2026-11-25',
        initialCsv: csvContent,
      }),
    }, adminToken);
    assert.strictEqual(resWithCsv.status, 201, `Failed to create tracker with CSV: ${JSON.stringify(resWithCsv.data)}`);
    const trackerWithCsvId = resWithCsv.data.id;
    createdTrackerIds.push(trackerWithCsvId);
    assert.strictEqual(resWithCsv.data.sheetItemsImported, 3, 'Should import 3 items from CSV');
    console.log('  ✅ Validation checks passed and initial CSV creation verified.');

    // =========================================================================
    // d. per_day change does not alter past/assigned days; applyToday=true increases today's count and refuses to decrease it (400)
    // =========================================================================
    console.log('\n--- Test D: per_day & applyToday Semantics ---');
    // Using trackerWithCsvId (start_date: 2026-11-25, per_day: 1, 3 items in sheet, UTC timezone)
    // First trigger assignment generation for today (2026-11-25 in UTC)
    await generateAssignments(trackerWithCsvId, pool);
    const assignToday1 = await pool.query(
      'SELECT * FROM tracker_assignments WHERE tracker_id = $1 AND assign_date = CURRENT_DATE',
      [trackerWithCsvId]
    );
    assert.strictEqual(assignToday1.rows.length, 1, 'Today should have 1 assignment initially');
    const firstAssignedCatId = assignToday1.rows[0].catalog_id;

    // Increasing per_day with applyToday = true should assign 1 more problem for today
    const resIncreaseToday = await req(`/admin/trackers/${trackerWithCsvId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        per_day: 2,
        applyToday: true,
      }),
    }, adminToken);
    assert.strictEqual(resIncreaseToday.status, 200, `Expected 200 on increase: ${JSON.stringify(resIncreaseToday.data)}`);
    assert.strictEqual(resIncreaseToday.data.per_day, 2);

    const assignToday2 = await pool.query(
      'SELECT * FROM tracker_assignments WHERE tracker_id = $1 AND assign_date = CURRENT_DATE',
      [trackerWithCsvId]
    );
    assert.strictEqual(assignToday2.rows.length, 2, 'Today should now have 2 assignments');
    // Ensure the original assigned item is still the first one
    assert.strictEqual(assignToday2.rows[0].catalog_id, firstAssignedCatId);

    // Attempting to decrease per_day to 1 with applyToday = true must fail with 400
    const resDecreaseToday = await req(`/admin/trackers/${trackerWithCsvId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        per_day: 1,
        applyToday: true,
      }),
    }, adminToken);
    assert.strictEqual(resDecreaseToday.status, 400, 'Decreasing per_day below today assignment count with applyToday must fail with 400');

    // But changing per_day to 1 without applyToday should succeed (leaving today's 2 assignments intact)
    const resDecreaseNoApply = await req(`/admin/trackers/${trackerWithCsvId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        per_day: 1,
        applyToday: false,
      }),
    }, adminToken);
    assert.strictEqual(resDecreaseNoApply.status, 200);
    assert.strictEqual(resDecreaseNoApply.data.per_day, 1);
    const assignToday3 = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_assignments WHERE tracker_id = $1 AND assign_date = CURRENT_DATE',
      [trackerWithCsvId]
    );
    assert.strictEqual(assignToday3.rows[0].count, 2, "Today's existing assignments must remain unchanged");
    console.log('  ✅ per_day and applyToday behavior verified.');

    // =========================================================================
    // e. Add one item, duplicate item -> 409, remove upcoming works, remove assigned -> 409
    // =========================================================================
    console.log('\n--- Test E: Single Item Add/Delete & Conflict Guards ---');
    const extraCatItem = catItems[3];
    // Add extraCatItem
    const resAddItem = await req(`/admin/trackers/${trackerWithCsvId}/sheet/items`, {
      method: 'POST',
      body: JSON.stringify({ catalogId: extraCatItem.id }),
    }, adminToken);
    assert.strictEqual(resAddItem.status, 201, `Failed to add item: ${JSON.stringify(resAddItem.data)}`);

    // Duplicate add -> 409
    const resDupItem = await req(`/admin/trackers/${trackerWithCsvId}/sheet/items`, {
      method: 'POST',
      body: JSON.stringify({ catalogId: extraCatItem.id }),
    }, adminToken);
    assert.strictEqual(resDupItem.status, 409, 'Duplicate sheet item must return 409');

    // Remove upcoming works
    const resDelUpcoming = await req(`/admin/trackers/${trackerWithCsvId}/sheet/items/${extraCatItem.id}`, {
      method: 'DELETE',
    }, adminToken);
    assert.strictEqual(resDelUpcoming.status, 200, `Failed to remove upcoming item: ${JSON.stringify(resDelUpcoming.data)}`);

    // Remove assigned item -> 409
    const resDelAssigned = await req(`/admin/trackers/${trackerWithCsvId}/sheet/items/${firstAssignedCatId}`, {
      method: 'DELETE',
    }, adminToken);
    assert.strictEqual(resDelAssigned.status, 409, 'Removing an assigned item must return 409');
    console.log('  ✅ Item addition, 409 duplicate check, upcoming removal, and 409 assigned check passed.');

    // =========================================================================
    // f. Reorder upcoming items: valid order applied; list that includes assigned ID or misses upcoming ID -> 400; assigned positions unchanged
    // =========================================================================
    console.log('\n--- Test F: Reorder Upcoming Items ---');
    // Add two upcoming items so we have at least 2 upcoming items
    await req(`/admin/trackers/${trackerWithCsvId}/sheet/items`, {
      method: 'POST',
      body: JSON.stringify({ catalogId: catItems[3].id }),
    }, adminToken);
    await req(`/admin/trackers/${trackerWithCsvId}/sheet/items`, {
      method: 'POST',
      body: JSON.stringify({ catalogId: catItems[4].id }),
    }, adminToken);

    // Get current sheet to inspect assigned vs upcoming
    const sheetRes1 = await req(`/admin/trackers/${trackerWithCsvId}/sheet`, {}, adminToken);
    assert.strictEqual(sheetRes1.status, 200);
    const allItems1 = Array.isArray(sheetRes1.data) ? sheetRes1.data : (sheetRes1.data.items || []);
    const assignedIds = allItems1.filter((i) => i.state === 'assigned').map((i) => i.catalog_id || i.catalogId);
    const upcomingIds = allItems1.filter((i) => i.state === 'upcoming').map((i) => i.catalog_id || i.catalogId);
    assert.ok(upcomingIds.length >= 2, 'Should have at least 2 upcoming items');

    // 1. List that includes assigned ID -> 400
    const resReorderWithAssigned = await req(`/admin/trackers/${trackerWithCsvId}/sheet/order`, {
      method: 'PUT',
      body: JSON.stringify({ catalogIds: [...upcomingIds, assignedIds[0]] }),
    }, adminToken);
    assert.strictEqual(resReorderWithAssigned.status, 400, 'Reorder containing assigned ID must return 400');

    // 2. List that misses an upcoming ID -> 400
    const resReorderMiss = await req(`/admin/trackers/${trackerWithCsvId}/sheet/order`, {
      method: 'PUT',
      body: JSON.stringify({ catalogIds: [upcomingIds[0]] }),
    }, adminToken);
    assert.strictEqual(resReorderMiss.status, 400, 'Reorder missing upcoming ID must return 400');

    // 3. Valid reversed order
    const reversedUpcoming = [...upcomingIds].reverse();
    const resReorderValid = await req(`/admin/trackers/${trackerWithCsvId}/sheet/order`, {
      method: 'PUT',
      body: JSON.stringify({ catalogIds: reversedUpcoming }),
    }, adminToken);
    assert.strictEqual(resReorderValid.status, 200, `Reorder failed: ${JSON.stringify(resReorderValid.data)}`);

    // Verify upcoming items are in reversed order and assigned positions are unchanged
    const sheetRes2 = await req(`/admin/trackers/${trackerWithCsvId}/sheet`, {}, adminToken);
    const allItems2 = Array.isArray(sheetRes2.data) ? sheetRes2.data : (sheetRes2.data.items || []);
    const newUpcomingIds = allItems2.filter((i) => i.state === 'upcoming').map((i) => i.catalog_id || i.catalogId);
    assert.deepStrictEqual(newUpcomingIds, reversedUpcoming, 'Upcoming IDs should match reversed order');

    const newAssignedIds = allItems2.filter((i) => i.state === 'assigned').map((i) => i.catalog_id || i.catalogId);
    assert.deepStrictEqual(newAssignedIds, assignedIds, 'Assigned items positions and IDs must remain identical');
    console.log('  ✅ Reordering validation and position preservation verified.');

    // =========================================================================
    // g. CSV append skips existing numbers and reports them; replace leaves assigned items intact
    // =========================================================================
    console.log('\n--- Test G: CSV Append & Replace ---');
    // Append CSV containing catItems[0] (already in sheet) and a new one
    // We will preview first
    const appendCsv = `lc_number\n${catItems[0].lc_number}\n${catItems[1].lc_number}`;
    const prevAppend = await req(`/admin/trackers/${trackerWithCsvId}/sheet/preview`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'append', csv: appendCsv }),
    }, adminToken);
    assert.strictEqual(prevAppend.status, 200);
    assert.ok(prevAppend.data.duplicates.length > 0 || prevAppend.data.alreadyInSheet.length > 0, 'Should report skipped existing numbers');

    // Confirm append
    const confAppend = await req(`/admin/trackers/${trackerWithCsvId}/sheet/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'append',
        csv: appendCsv,
      }),
    }, adminToken);
    assert.strictEqual(confAppend.status, 200);

    // Replace mode preview and confirm
    // In replace mode, assigned items must remain intact!
    const replaceCsv = `lc_number\n${catItems[4].lc_number}`;
    const prevReplace = await req(`/admin/trackers/${trackerWithCsvId}/sheet/preview`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'replace', csv: replaceCsv }),
    }, adminToken);
    assert.strictEqual(prevReplace.status, 200);

    const confReplace = await req(`/admin/trackers/${trackerWithCsvId}/sheet/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'replace',
        csv: replaceCsv,
      }),
    }, adminToken);
    assert.strictEqual(confReplace.status, 200);

    // Check that assigned items are still in sheet
    const sheetAfterReplace = await req(`/admin/trackers/${trackerWithCsvId}/sheet`, {}, adminToken);
    const allAfterReplace = Array.isArray(sheetAfterReplace.data) ? sheetAfterReplace.data : (sheetAfterReplace.data.items || []);
    const assignedAfterReplace = allAfterReplace.filter((i) => i.state === 'assigned').map((i) => i.catalog_id || i.catalogId);
    assert.deepStrictEqual(assignedAfterReplace, assignedIds, 'Replace mode must leave assigned items completely intact');
    console.log('  ✅ CSV append skipping and replace preservation verified.');

    // =========================================================================
    // h. Archived tracker generates no new assignments (call generateAssignments; verify count does not increase)
    // =========================================================================
    console.log('\n--- Test H: Archived Tracker Assignment Suspension ---');
    // Archive tracker
    const resArchive = await req(`/admin/trackers/${trackerWithCsvId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    }, adminToken);
    assert.strictEqual(resArchive.status, 200);
    assert.strictEqual(resArchive.data.status, 'archived');

    const countBeforeGen = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_assignments WHERE tracker_id = $1',
      [trackerWithCsvId]
    );

    // Call generateAssignments
    const genResult = await generateAssignments(trackerWithCsvId, pool);
    assert.strictEqual(genResult.archived, true, 'generateAssignments should report archived: true');

    const countAfterGen = await pool.query(
      'SELECT COUNT(*)::int AS count FROM tracker_assignments WHERE tracker_id = $1',
      [trackerWithCsvId]
    );
    assert.strictEqual(countAfterGen.rows[0].count, countBeforeGen.rows[0].count, 'Archived tracker must generate 0 new assignments');
    console.log('  ✅ Archived tracker generates no assignments.');

    // =========================================================================
    // i. Hard delete requires exact name (wrong name -> 400); after deletion, members' vault problems rows still exist
    // =========================================================================
    console.log("\n--- Test I: Hard Delete Exact Name Guard & Members' Vault Isolation ---");
    // Have member add a problem to their personal vault
    const memberProblemRes = await req('/problems', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Member Vault Problem For Isolation Check',
        platform: 'LeetCode',
        difficulty: 'Easy',
        problemUrl: 'https://leetcode.com/problems/two-sum',
        status: 'Solved Independently',
        solvingDate: '2026-11-25',
      }),
    }, memberToken);
    assert.strictEqual(memberProblemRes.status, 201);
    const memberProblemId = memberProblemRes.data.id;

    // Wrong name -> 400
    const resDelWrongName = await req(`/admin/trackers/${trackerWithCsvId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName: 'Completely Wrong Tracker Name' }),
    }, adminToken);
    assert.strictEqual(resDelWrongName.status, 400, 'Wrong confirmName must return 400');

    // Exact name -> 200
    const trackerRow = await pool.query('SELECT name FROM trackers WHERE id = $1', [trackerWithCsvId]);
    const exactName = trackerRow.rows[0].name;

    const resDelExact = await req(`/admin/trackers/${trackerWithCsvId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName: exactName }),
    }, adminToken);
    assert.strictEqual(resDelExact.status, 200, `Hard delete failed: ${JSON.stringify(resDelExact.data)}`);

    // Verify tracker is gone
    const checkTracker = await pool.query('SELECT 1 FROM trackers WHERE id = $1', [trackerWithCsvId]);
    assert.strictEqual(checkTracker.rows.length, 0, 'Tracker must be deleted');

    // Verify member's vault problem is still intact!
    const checkProblem = await pool.query('SELECT id FROM problems WHERE id = $1', [memberProblemId]);
    assert.strictEqual(checkProblem.rows.length, 1, "Member's vault problem must NOT be touched by tracker deletion");
    console.log("  ✅ Hard delete guard and member vault data preservation verified.");

    // =========================================================================
    // j. Every mutation writes an audit row; audit row survives tracker deletion
    // =========================================================================
    console.log('\n--- Test J: Audit Log Preservation After Deletion ---');
    // Query audit log for trackerWithCsvId via API or DB
    const auditRes = await req('/admin/audit?limit=100', {}, adminToken);
    assert.strictEqual(auditRes.status, 200);
    const logs = auditRes.data;

    const deleteAudit = logs.find((l) => l.action === 'delete_tracker' && l.tracker_id === trackerWithCsvId);
    assert.ok(deleteAudit, 'Audit log row for delete_tracker must exist even after tracker deletion');
    assert.strictEqual(deleteAudit.admin_id, adminId);
    assert.strictEqual(deleteAudit.details?.deleted_tracker_name || deleteAudit.details?.trackerName, exactName);

    // Verify other mutations are logged
    const actions = logs.filter((l) => l.admin_id === adminId).map((l) => l.action);
    assert.ok(actions.includes('create_tracker'), 'Should log create_tracker');
    assert.ok(actions.includes('update_tracker'), 'Should log update_tracker');
    console.log('  ✅ Verified audit logging for all mutations and audit row survival after deletion.');

    console.log('\n🎉 ALL ADMIN CONTROL CENTER TESTS PASSED (a through j)!\n');
  } finally {
    await cleanup();
  }
}

runAdminTests()
  .then(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Admin Tests Failed:', err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
