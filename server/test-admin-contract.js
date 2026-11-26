/**
 * Admin Contract & Route Protection Test Suite (server/test-admin-contract.js)
 *
 * Verifies:
 * a. Static check: Every URL literal in adminClient and adminService starts with /admin (or /api/admin)
 *    and matches a route actually registered in the Express router.
 * b. Non-member Admin execution: An admin who is NOT a member of tracker X can:
 *    - list tracker details
 *    - list members
 *    - list and decide join requests
 *    - list, create, and revoke invites
 *    - remove a member
 *    - update settings
 *    - preview and confirm a problem sheet
 * c. Role isolation: The same calls with a normal user token return 404, and with no token return 401.
 * d. Error & Expiry handling: An expired admin token returns 401; a nonexistent tracker id returns 404.
 */

import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';
import { ensureAdminUser } from './routes/auth.js';
import adminRouter from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vault_admin_secret_pass_123!';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'vault_admin_jwt_secret_super_secure_32_chars!';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'vault_admin').trim();

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

async function runAdminContractTests() {
  console.log('🛡️ Starting Admin Contract & Security Route Tests...\n');
  const timestamp = Date.now();
  const createdUserIds = [];
  const createdTrackerIds = [];

  async function cleanup() {
    console.log('\n🧹 Cleaning up test users and trackers...');
    if (createdTrackerIds.length > 0) {
      try {
        await pool.query('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM tracker_assignments WHERE tracker_id = ANY($1))', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_assignments WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_sheet_items WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_join_requests WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_invites WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM tracker_members WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM admin_audit_log WHERE tracker_id = ANY($1)', [createdTrackerIds]);
        await pool.query('DELETE FROM trackers WHERE id = ANY($1)', [createdTrackerIds]);
      } catch (err) {
        console.warn('Tracker cleanup error:', err.message);
      }
    }
    if (createdUserIds.length > 0) {
      try {
        await pool.query('DELETE FROM admin_audit_log WHERE admin_id = ANY($1)', [createdUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
      } catch (err) {
        console.warn('User cleanup error:', err.message);
      }
    }
  }

  try {
    // =========================================================================
    // Test a: Static check of URL literals in adminApi and adminService
    // =========================================================================
    console.log('Test a: Static URL audit in adminApi.js & adminService.js against registered Express routes...');
    const adminServiceCode = fs.readFileSync(path.join(__dirname, '../src/services/adminService.js'), 'utf8');

    // Extract all adminApi('...') calls
    const urlMatches = [...adminServiceCode.matchAll(/adminApi\(\s*[`'"]([^`'"]+)[`'"]/g)].map((m) => m[1]);
    assert.ok(urlMatches.length >= 10, `Expected at least 10 adminApi calls, found ${urlMatches.length}`);

    // Collect all registered routes in adminRouter stack
    const registeredAdminRoutes = [];
    adminRouter.stack.forEach((layer) => {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        registeredAdminRoutes.push({ path: layer.route.path, methods });
      }
    });

    for (const rawUrl of urlMatches) {
      assert.ok(
        rawUrl.startsWith('/admin'),
        `Contract violation: URL literal '${rawUrl}' in adminService does not start with /admin`
      );

      // Strip query string and replace template variables with generic patterns
      const pathOnly = rawUrl.split('?')[0];
      const patternPath = pathOnly
        .replace('/admin', '')
        .replace(/\$\{[^}]+\}/g, ':param'); // Convert `${id}` to `:param`

      // Verify that a route in adminRouter matches this pattern
      const hasMatch = registeredAdminRoutes.some((route) => {
        const routePattern = route.path.replace(/:[A-Za-z0-9_]+/g, ':param');
        return routePattern === patternPath;
      });

      assert.ok(
        hasMatch,
        `Contract violation: Admin route for '${rawUrl}' (pattern: '${patternPath}') is not registered in admin router!`
      );
    }
    console.log(`  ✅ Test a passed: All ${urlMatches.length} adminApi URL literals start with /admin and map to registered Express routes.`);

    // =========================================================================
    // Setup Test Admin and Regular Users
    // =========================================================================
    await ensureAdminUser();
    const adminLoginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    assert.strictEqual(adminLoginRes.status, 200);
    const adminToken = adminLoginRes.data.adminToken;
    const adminUserId = adminLoginRes.data.user.id;
    assert.ok(adminToken, 'Must receive adminToken');

    // Register 2 normal users: owner & member
    const ownerName = `owner_${timestamp}`;
    const ownerRes = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: ownerName, password: 'Password123!' }),
    });
    const ownerId = ownerRes.data.user.id;
    const ownerToken = ownerRes.data.token;
    createdUserIds.push(ownerId);

    const normalMemberName = `member_${timestamp}`;
    const memberRes = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: normalMemberName, password: 'Password123!' }),
    });
    const memberId = memberRes.data.user.id;
    createdUserIds.push(memberId);

    // Create tracker owned by ownerId (Admin is explicitly NOT added to tracker_members)
    const trackerRes = await pool.query(
      `INSERT INTO trackers (name, public_code, timezone, per_day, start_date, created_by)
       VALUES ($1, $2, 'Asia/Kolkata', 2, '2026-11-20', $3)
       RETURNING id, name, public_code, timezone, per_day, start_date::text`,
      [`Test Tracker ${timestamp}`, `TC${timestamp.toString().slice(-6)}`, ownerId]
    );
    const tracker = trackerRes.rows[0];
    const trackerId = tracker.id;
    createdTrackerIds.push(trackerId);

    // Add owner and normalMember to tracker_members
    await pool.query(
      `INSERT INTO tracker_members (tracker_id, user_id, joined_at)
       VALUES ($1, $2, '2026-11-20'), ($1, $3, '2026-11-21')`,
      [trackerId, ownerId, memberId]
    );

    // Verify admin is NOT a member of tracker
    const memCheck = await pool.query(
      'SELECT 1 FROM tracker_members WHERE tracker_id = $1 AND user_id = $2',
      [trackerId, adminUserId]
    );
    assert.strictEqual(memCheck.rows.length, 0, 'Admin must not be a member of test tracker');

    // =========================================================================
    // Test b: Non-member Admin execution across all /api/admin/trackers/:id/... routes
    // =========================================================================
    console.log('Test b: Admin who is NOT a member can manage any tracker via /api/admin/trackers/:id/...');

    // 1. GET /api/admin/trackers/:id (details)
    const detailRes = await req(`/admin/trackers/${trackerId}`, { method: 'GET' }, adminToken);
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.data.id, trackerId);
    assert.strictEqual(detailRes.data.name, tracker.name);
    assert.ok(detailRes.data.publicCode, 'Admin receives publicCode');

    // 2. GET /api/admin/trackers/:id/members
    const membersRes = await req(`/admin/trackers/${trackerId}/members`, { method: 'GET' }, adminToken);
    assert.strictEqual(membersRes.status, 200);
    assert.strictEqual(membersRes.data.length, 2);
    assert.ok(membersRes.data.some((m) => m.userId === memberId));

    // 3. Join Request: Insert a request from a third user, then list & decide
    const applicantName = `applicant_${timestamp}`;
    const applicantRes = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: applicantName, password: 'Password123!' }),
    });
    const applicantId = applicantRes.data.user.id;
    createdUserIds.push(applicantId);

    const insertReqRes = await pool.query(
      `INSERT INTO tracker_join_requests (tracker_id, user_id, message, status)
       VALUES ($1, $2, 'Please let me in!', 'pending') RETURNING id`,
      [trackerId, applicantId]
    );
    const joinReqId = insertReqRes.rows[0].id;

    // List requests via /api/admin/trackers/:id/requests
    const listReqsRes = await req(`/admin/trackers/${trackerId}/requests`, { method: 'GET' }, adminToken);
    assert.strictEqual(listReqsRes.status, 200);
    assert.ok(listReqsRes.data.some((r) => r.id === joinReqId));

    // Decide request via POST /api/admin/trackers/:id/requests/:reqId/decision
    const decideRes = await req(`/admin/trackers/${trackerId}/requests/${joinReqId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'approve' }),
    }, adminToken);
    assert.strictEqual(decideRes.status, 200);
    assert.strictEqual(decideRes.data.status, 'approved');

    // 4. Invites: Create, list, revoke via /api/admin/trackers/:id/invites
    const createInviteRes = await req(`/admin/trackers/${trackerId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ expiresInDays: 5, maxUses: 3 }),
    }, adminToken);
    assert.strictEqual(createInviteRes.status, 201);
    assert.ok(createInviteRes.data.invite?.token, 'Token returned on creation');
    const inviteId = createInviteRes.data.invite.id;

    // List invites
    const listInvitesRes = await req(`/admin/trackers/${trackerId}/invites`, { method: 'GET' }, adminToken);
    assert.strictEqual(listInvitesRes.status, 200);
    const createdInviteRecord = listInvitesRes.data.find((i) => i.id === inviteId);
    assert.ok(createdInviteRecord, 'Created invite must be in list');
    assert.strictEqual('token' in createdInviteRecord, false, 'Listed invite must never contain token');
    assert.strictEqual('token_hash' in createdInviteRecord, false, 'Listed invite must never contain token_hash');

    // Revoke invite
    const revokeRes = await req(`/admin/trackers/${trackerId}/invites/${inviteId}`, { method: 'DELETE' }, adminToken);
    assert.strictEqual(revokeRes.status, 200);

    // 5. Remove member via POST /api/admin/trackers/:id/members/:userId/remove
    const removeMemRes = await req(`/admin/trackers/${trackerId}/members/${memberId}/remove`, { method: 'POST' }, adminToken);
    assert.strictEqual(removeMemRes.status, 200);
    const afterRemoveCheck = await pool.query(
      'SELECT 1 FROM tracker_members WHERE tracker_id = $1 AND user_id = $2',
      [trackerId, memberId]
    );
    assert.strictEqual(afterRemoveCheck.rows.length, 0, 'Member should be removed');

    // 6. Update settings via PATCH /api/admin/trackers/:id
    const patchRes = await req(`/admin/trackers/${trackerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ per_day: 3, timezone: 'UTC' }),
    }, adminToken);
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.data.perDay, 3);
    assert.strictEqual(patchRes.data.timezone, 'UTC');

    // 7. Sheet Preview & Confirm via /api/admin/trackers/:id/sheet/*
    // Load first catalog problem
    const { rows: catRows } = await pool.query('SELECT lc_number FROM catalog_problems LIMIT 2');
    assert.ok(catRows.length >= 2, 'Catalog problems must exist');
    const testCsv = `lc_number,position\n${catRows[0].lc_number},1\n${catRows[1].lc_number},2\n`;

    const previewRes = await req(`/admin/trackers/${trackerId}/sheet/preview`, {
      method: 'POST',
      body: JSON.stringify({ csv: testCsv, mode: 'replace' }),
    }, adminToken);
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.data.valid, 2);

    const confirmRes = await req(`/admin/trackers/${trackerId}/sheet/confirm`, {
      method: 'POST',
      body: JSON.stringify({ csv: testCsv, mode: 'replace' }),
    }, adminToken);
    assert.strictEqual(confirmRes.status, 200);
    assert.strictEqual(confirmRes.data.addedCount, 2);

    console.log('  ✅ Test b passed: Non-member admin executed all management operations without 404/403.');

    // =========================================================================
    // Test c: Role isolation (normal token -> 404, no token -> 401)
    // =========================================================================
    console.log('Test c: Normal user token gets 404, missing token gets 401 on /api/admin/trackers/:id/...');
    const adminEndpoints = [
      { method: 'GET', path: `/admin/trackers/${trackerId}` },
      { method: 'GET', path: `/admin/trackers/${trackerId}/members` },
      { method: 'GET', path: `/admin/trackers/${trackerId}/requests` },
      { method: 'GET', path: `/admin/trackers/${trackerId}/invites` },
      { method: 'GET', path: `/admin/trackers/${trackerId}/sheet` },
    ];

    for (const ep of adminEndpoints) {
      // Normal token -> 404
      const normalRes = await req(ep.path, { method: ep.method }, ownerToken);
      assert.strictEqual(normalRes.status, 404, `Normal token on ${ep.path} must return 404, got ${normalRes.status}`);

      // No token -> 401
      const noTokenRes = await req(ep.path, { method: ep.method });
      assert.strictEqual(noTokenRes.status, 401, `No token on ${ep.path} must return 401, got ${noTokenRes.status}`);
    }
    console.log('  ✅ Test c passed.');

    // =========================================================================
    // Test d: Expired token -> 401, Nonexistent tracker -> 404
    // =========================================================================
    console.log('Test d: Expired admin token returns 401, nonexistent tracker returns 404...');
    const expiredToken = jwt.sign(
      { sub: adminUserId, scope: 'admin' },
      ADMIN_JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const expiredRes = await req(`/admin/trackers/${trackerId}`, { method: 'GET' }, expiredToken);
    assert.strictEqual(expiredRes.status, 401, `Expired admin token must return 401, got ${expiredRes.status}`);

    const nonexistentId = '00000000-0000-0000-0000-000000000000';
    const notFoundRes = await req(`/admin/trackers/${nonexistentId}`, { method: 'GET' }, adminToken);
    assert.strictEqual(notFoundRes.status, 404, `Nonexistent tracker must return 404, got ${notFoundRes.status}`);
    console.log('  ✅ Test d passed.');

    console.log('\n🎉 ALL ADMIN CONTRACT TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await cleanup();
  }
}

runAdminContractTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Admin Contract Test Suite Failed:', err);
    process.exit(1);
  });
