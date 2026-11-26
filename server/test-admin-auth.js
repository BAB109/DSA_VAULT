/**
 * Admin Authentication & Security Test Suite
 *
 * Covers:
 * a. Admin logs in via /api/auth/login and receives adminToken; a normal user's login response has no adminToken key.
 * b. Wrong password for the admin, wrong password for a normal user, and an unknown username return identical 401 bodies.
 * c. /api/admin/login returns 404.
 * d. A normal token on any /api/admin route -> 404; an admin token for a user whose is_admin was set false in the DB is refused (404); a token signed with JWT_SECRET is refused (404).
 * e. 6th failure from one IP+username returns 429; the correct admin password from a different IP still succeeds during an attack on that username; the per-IP cap of 20 across usernames returns 429.
 * f. Registering ADMIN_USERNAME (any case, with spaces) -> 409 USERNAME_TAKEN.
 * g. Failed attempts against ADMIN_USERNAME write an audit row with null admin_id; no row or log contains the password.
 * h. /api/auth/me never returns an adminToken.
 */

import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { ensureAdminUser, resetLoginFailureTracking } from './routes/auth.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vault_admin_secret_pass_123!';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'vault_admin_jwt_secret_super_secure_32_chars!';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'vault_admin').trim();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';

// Capture all response bodies and logs to verify no secrets are leaked
const recordedResponseBodies = [];
const recordedLogLines = [];

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function captureLog(...args) {
  const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  recordedLogLines.push(line);
  originalLog.apply(console, args);
}
function captureWarn(...args) {
  const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  recordedLogLines.push(line);
  originalWarn.apply(console, args);
}
function captureError(...args) {
  const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  recordedLogLines.push(line);
  originalError.apply(console, args);
}

console.log = captureLog;
console.warn = captureWarn;
console.error = captureError;

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

  recordedResponseBodies.push(JSON.stringify(data));
  return { status: res.status, data, headers: res.headers };
}

async function runAdminAuthTests() {
  console.log('🔒 Starting Admin Authentication & Security Tests (One Login Architecture)...\n');
  const timestamp = Date.now();
  const createdUserIds = [];

  async function cleanup() {
    console.log('\n🧹 Cleaning up test users and audit logs...');
    if (createdUserIds.length > 0) {
      try {
        await pool.query('DELETE FROM admin_audit_log WHERE admin_id = ANY($1)', [createdUserIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
      } catch (err) {
        console.warn('Cleanup error:', err.message);
      }
    }
    // Restore original console
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  try {
    // Ensure the main admin user exists in DB
    await ensureAdminUser();
    const { rows: mainAdminRows } = await pool.query(
      'SELECT id, username, password_hash, is_admin FROM users WHERE lower(username) = lower($1)',
      [ADMIN_USERNAME]
    );
    assert.ok(mainAdminRows.length > 0, `Main admin user ${ADMIN_USERNAME} must exist in DB`);
    const mainAdminId = mainAdminRows[0].id;

    // Reset rate limiter maps
    resetLoginFailureTracking();

    // =========================================================================
    // Subtest a: Admin logs in via /api/auth/login and receives adminToken;
    // normal user's login response has NO adminToken key at all.
    // =========================================================================
    console.log('Test a: POST /api/auth/login returns adminToken for admin, omitted for normal user...');
    const adminLoginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    assert.strictEqual(adminLoginRes.status, 200, `Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    assert.ok(adminLoginRes.data.token, 'Response must include normal token');
    assert.ok(adminLoginRes.data.adminToken, 'Admin response must include adminToken');
    assert.ok(adminLoginRes.data.adminExpiresAt, 'Admin response must include adminExpiresAt');
    assert.strictEqual(adminLoginRes.data.user.isAdmin, true, 'User isAdmin must be true');

    const decodedAdminToken = jwt.verify(adminLoginRes.data.adminToken, ADMIN_JWT_SECRET);
    assert.strictEqual(decodedAdminToken.scope, 'admin', 'Admin token scope must be admin');
    assert.strictEqual(decodedAdminToken.sub, mainAdminId, 'Admin token sub must match admin user ID');

    // Register a normal user
    const normalUser = `normal_test_${timestamp}`;
    const normalPass = 'NormalSecretPass123!';
    const regRes = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: normalUser, password: normalPass }),
    });
    assert.strictEqual(regRes.status, 201, `Failed to register normal user: ${JSON.stringify(regRes.data)}`);
    createdUserIds.push(regRes.data.user.id);
    const normalToken = regRes.data.token;

    // Normal user login
    const normalLoginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: normalUser, password: normalPass }),
    });
    assert.strictEqual(normalLoginRes.status, 200);
    assert.ok(normalLoginRes.data.token, 'Normal response must include token');
    assert.strictEqual('adminToken' in normalLoginRes.data, false, 'Normal user response must NOT have adminToken key');
    assert.strictEqual('adminExpiresAt' in normalLoginRes.data, false, 'Normal user response must NOT have adminExpiresAt key');
    assert.strictEqual(normalLoginRes.data.user.isAdmin, false);
    console.log('  ✅ Test a passed.');

    // =========================================================================
    // Subtest b: Wrong password for admin, wrong password for normal user,
    // and unknown username return identical 401 bodies.
    // =========================================================================
    console.log('Test b: Identical 401 bodies for wrong admin pass, wrong normal pass, and unknown user...');
    const expected401 = { error: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' };

    const wrongAdminPass = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: 'WrongPassword999!' }),
    });
    assert.strictEqual(wrongAdminPass.status, 401);
    assert.deepStrictEqual(wrongAdminPass.data, expected401, 'Wrong admin password must return standard 401');

    const wrongNormalPass = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: normalUser, password: 'WrongPassword888!' }),
    });
    assert.strictEqual(wrongNormalPass.status, 401);
    assert.deepStrictEqual(wrongNormalPass.data, expected401, 'Wrong normal password must return standard 401');

    const unknownUserRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: `nonexistent_${timestamp}`, password: 'Password123!' }),
    });
    assert.strictEqual(unknownUserRes.status, 401);
    assert.deepStrictEqual(unknownUserRes.data, expected401, 'Unknown user must return standard 401');
    console.log('  ✅ Test b passed.');

    // =========================================================================
    // Subtest c: POST /api/admin/login returns 404
    // =========================================================================
    console.log('Test c: POST /api/admin/login returns 404...');
    const adminLoginEndpointRes = await req('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    assert.strictEqual(adminLoginEndpointRes.status, 404, `/api/admin/login must return 404, got ${adminLoginEndpointRes.status}`);
    console.log('  ✅ Test c passed.');

    // =========================================================================
    // Subtest d: Normal token on /api/admin -> 404; admin token whose is_admin
    // was set false in DB is refused (404); token signed with JWT_SECRET is refused (404).
    // =========================================================================
    console.log('Test d: /api/admin route protection (requireAdmin checks)...');
    // 1. Normal user token on GET /api/admin/trackers returns 404
    const normalOnAdmin = await req('/admin/trackers', { method: 'GET' }, normalToken);
    assert.strictEqual(normalOnAdmin.status, 404, `Normal user token must get 404 on admin route, got ${normalOnAdmin.status}`);

    // 2. Token signed with normal JWT_SECRET (even with {scope: 'admin'}) returns 404
    const fakeSecretAdminToken = jwt.sign(
      { sub: mainAdminId, scope: 'admin' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    const fakeSecretRes = await req('/admin/trackers', { method: 'GET' }, fakeSecretAdminToken);
    assert.strictEqual(fakeSecretRes.status, 404, `Token signed with JWT_SECRET must return 404 on admin route, got ${fakeSecretRes.status}`);

    // 3. Admin token for a user whose is_admin was set false in DB is refused (404)
    const demoteUsername = `demote_user_${timestamp}`;
    const demoteHash = await bcrypt.hash('DemotePass123!', 12);
    const insertDemoteRes = await pool.query(
      `INSERT INTO users (username, password_hash, is_admin)
       VALUES ($1, $2, true) RETURNING id`,
      [demoteUsername, demoteHash]
    );
    const demoteUserId = insertDemoteRes.rows[0].id;
    createdUserIds.push(demoteUserId);

    const demoteAdminToken = jwt.sign(
      { sub: demoteUserId, scope: 'admin' },
      ADMIN_JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Initial check: succeeds
    const initialCheck = await req('/admin/trackers', { method: 'GET' }, demoteAdminToken);
    assert.strictEqual(initialCheck.status, 200, 'Admin token should succeed when is_admin=true');

    // Demote user in DB
    await pool.query('UPDATE users SET is_admin = false WHERE id = $1', [demoteUserId]);

    // Next request with same token must be refused with 404
    const afterDemoteCheck = await req('/admin/trackers', { method: 'GET' }, demoteAdminToken);
    assert.strictEqual(afterDemoteCheck.status, 404, `Demoted user token must return 404, got ${afterDemoteCheck.status}`);
    console.log('  ✅ Test d passed.');

    // =========================================================================
    // Subtest e: Rate limiting on POST /api/auth/login:
    // - 6th failure from one IP+username returns 429
    // - Correct admin password from a different IP still succeeds during attack on that username
    // - Per-IP cap of 20 across usernames returns 429
    // =========================================================================
    console.log('Test e: Rate limiting: IP+username cap (5->429), IP immunity for different IP, and per-IP cap (20->429)...');
    resetLoginFailureTracking();

    const victimUser = `victim_${timestamp}`;
    const attackerIp1 = '198.51.100.1';
    const legitimateIp = '203.0.113.5';

    // 1. Send 5 failed attempts from attackerIp1 for victimUser
    for (let i = 1; i <= 5; i++) {
      const res = await req('/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': attackerIp1 },
        body: JSON.stringify({ username: victimUser, password: 'WrongPassword!' }),
      });
      assert.strictEqual(res.status, 401, `Attempt ${i} should be 401, got ${res.status}`);
    }

    // 6th attempt from attackerIp1 for victimUser must return 429
    const blockedRes = await req('/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': attackerIp1 },
      body: JSON.stringify({ username: victimUser, password: 'WrongPassword!' }),
    });
    assert.strictEqual(blockedRes.status, 429, `6th failure from same IP+username must return 429, got ${blockedRes.status}`);
    assert.strictEqual(blockedRes.data.error, 'TOO_MANY_REQUESTS');

    // 2. An attack on ADMIN_USERNAME from attackerIp1 must NOT block legitimate admin from legitimateIp!
    const attackerIp2 = '198.51.100.2';
    for (let i = 1; i <= 6; i++) {
      await req('/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': attackerIp2 },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: 'AttackerPassword!' }),
      });
    }
    // Now legitimate admin attempts login from legitimateIp -> must succeed!
    const legitAdminRes = await req('/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': legitimateIp },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    assert.strictEqual(legitAdminRes.status, 200, `Legitimate admin login from different IP must succeed during attack, got ${legitAdminRes.status}`);

    // 3. Per-IP cap of 20 failures across various usernames
    const spamIp = '198.51.100.99';
    for (let i = 1; i <= 20; i++) {
      const res = await req('/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': spamIp },
        body: JSON.stringify({ username: `random_user_${i}_${timestamp}`, password: 'WrongPassword!' }),
      });
      // Individual usernames only fail once, so they don't hit the 5-per-pair cap
      if (i < 20) {
        assert.strictEqual(res.status, 401, `Spam attempt ${i} should be 401`);
      }
    }
    // 21st attempt from spamIp must return 429 even with brand new username
    const spamCapRes = await req('/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': spamIp },
      body: JSON.stringify({ username: `brand_new_user_${timestamp}`, password: 'WrongPassword!' }),
    });
    assert.strictEqual(spamCapRes.status, 429, `21st attempt from same IP must hit per-IP cap (429), got ${spamCapRes.status}`);
    console.log('  ✅ Test e passed.');

    // =========================================================================
    // Subtest f: Registering ADMIN_USERNAME (any case, with spaces) -> 409
    // =========================================================================
    console.log('Test f: Registration of ADMIN_USERNAME variations fails with 409...');
    // Exact match
    const regExact = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: 'Password123!' }),
    });
    assert.strictEqual(regExact.status, 409);
    assert.strictEqual(regExact.data.error, 'USERNAME_TAKEN');

    // Uppercase variation
    const regUpper = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME.toUpperCase(), password: 'Password123!' }),
    });
    assert.strictEqual(regUpper.status, 409);
    assert.strictEqual(regUpper.data.error, 'USERNAME_TAKEN');

    // Leading / trailing whitespace
    const regSpaces = await req('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: `   ${ADMIN_USERNAME}   `, password: 'Password123!' }),
    });
    assert.strictEqual(regSpaces.status, 409);
    assert.strictEqual(regSpaces.data.error, 'USERNAME_TAKEN');
    console.log('  ✅ Test f passed.');

    // =========================================================================
    // Subtest g: Failed attempts against ADMIN_USERNAME write an audit row with null admin_id;
    // no row or log contains the password.
    // =========================================================================
    console.log('Test g: Audit logging for ADMIN_USERNAME attempts and zero password leakage...');
    const auditProbeUsername = ADMIN_USERNAME;
    const testSecretMarker = `ProbePass_${timestamp}_TopSecret!`;

    // Attempt failed login with marker password
    await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: auditProbeUsername, password: testSecretMarker }),
    });

    // Check DB for audit log entry
    const { rows: auditRows } = await pool.query(
      `SELECT id, admin_id, action, details
       FROM admin_audit_log
       WHERE action = 'admin_login_failure'
       ORDER BY created_at DESC LIMIT 5`
    );
    assert.ok(auditRows.length > 0, 'Must have recorded admin_login_failure audit log row');

    // Verify audit logs do not contain the password
    const { rows: allAuditRows } = await pool.query('SELECT details FROM admin_audit_log ORDER BY created_at DESC LIMIT 20');
    for (const row of allAuditRows) {
      const detailsStr = JSON.stringify(row.details || {});
      assert.strictEqual(
        detailsStr.includes(testSecretMarker),
        false,
        'CRITICAL: Audit log contains submitted password!'
      );
      assert.strictEqual(
        detailsStr.includes(ADMIN_PASSWORD),
        false,
        'CRITICAL: Audit log contains ADMIN_PASSWORD!'
      );
    }

    // Verify no response body or log line contains ADMIN_PASSWORD or ADMIN_JWT_SECRET
    for (const bodyStr of recordedResponseBodies) {
      assert.ok(!bodyStr.includes(ADMIN_PASSWORD), 'CRITICAL LEAK: Response body contains ADMIN_PASSWORD!');
      assert.ok(!bodyStr.includes(ADMIN_JWT_SECRET), 'CRITICAL LEAK: Response body contains ADMIN_JWT_SECRET!');
      assert.ok(!bodyStr.includes(testSecretMarker), 'CRITICAL LEAK: Response body contains testSecretMarker!');
    }

    for (const logLine of recordedLogLines) {
      assert.ok(!logLine.includes(ADMIN_PASSWORD), 'CRITICAL LEAK: Log output contains ADMIN_PASSWORD!');
      assert.ok(!logLine.includes(ADMIN_JWT_SECRET), 'CRITICAL LEAK: Log output contains ADMIN_JWT_SECRET!');
    }
    console.log('  ✅ Test g passed.');

    // =========================================================================
    // Subtest h: /api/auth/me never returns an adminToken
    // =========================================================================
    console.log('Test h: /api/auth/me never returns adminToken...');
    // Login as admin to get token
    const adminTokenLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    const adminUserToken = adminTokenLogin.data.token;

    const meRes = await req('/auth/me', { method: 'GET' }, adminUserToken);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual('adminToken' in meRes.data, false, '/api/auth/me response must not have adminToken key');
    assert.strictEqual('adminToken' in meRes.data.user, false, '/api/auth/me user object must not have adminToken key');
    assert.strictEqual('adminExpiresAt' in meRes.data, false, '/api/auth/me must not have adminExpiresAt key');
    console.log('  ✅ Test h passed.');

    console.log('\n🎉 ALL ADMIN AUTH & SECURITY TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    await cleanup();
  }
}

runAdminAuthTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    originalError('\n❌ Test Suite Failed:', err);
    process.exit(1);
  });
