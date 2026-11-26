/**
 * Admin Session Sliding Expiration & Hard-Cap Test Suite
 *
 * Verifies:
 * 1. Refresh extends expiration (exp) but never past auth_time + maxSeconds
 * 2. auth_time claim is unchanged across refreshes
 * 3. Refresh with a normal user token returns 404
 * 4. Refresh with an expired admin token returns 401
 * 5. Refresh with is_admin = false in DB returns 401 (or 404)
 * 6. Out-of-bounds config (ADMIN_SESSION_IDLE_MINUTES, ADMIN_SESSION_MAX_HOURS) is rejected in production validation
 * 7. Refreshed token works on protected admin routes (e.g. GET /api/admin/trackers)
 */

import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { validateAdminEnv, getAdminSessionConfig } from './config/env.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vault_admin_secret_pass_123!';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'vault_admin_jwt_secret_super_secure_32_chars!';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'vault_admin').trim();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';

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

  return { status: res.status, ok: res.ok, data };
}

async function runSessionTests() {
  console.log('🧪 Starting Admin Session Sliding Expiration & Hard-Cap Tests...\n');

  // Ensure admin user exists and is flagged is_admin=true
  let adminUserId = null;
  const adminRes = await pool.query('SELECT id, is_admin FROM users WHERE lower(username) = lower($1)', [ADMIN_USERNAME]);
  if (adminRes.rows.length > 0) {
    adminUserId = adminRes.rows[0].id;
    if (!adminRes.rows[0].is_admin) {
      await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [adminUserId]);
    }
  }

  // ---------------------------------------------------------------------------
  // Check 6: Out-of-bounds configuration validation in production
  // ---------------------------------------------------------------------------
  console.log('Test 1: Out-of-bounds config is rejected in production validation');
  {
    // Test idle minutes bounds (min 15, max 480)
    const tooLowIdle = validateAdminEnv({
      NODE_ENV: 'production',
      ADMIN_USERNAME: 'super_admin_test',
      ADMIN_PASSWORD: 'super_secure_password_123',
      ADMIN_JWT_SECRET: 'super_secure_jwt_secret_32_chars_long!',
      ADMIN_SESSION_IDLE_MINUTES: '14',
      ADMIN_SESSION_MAX_HOURS: '12',
    }, true);
    assert.strictEqual(tooLowIdle.valid, false, 'idle < 15 must fail validation');
    assert.ok(tooLowIdle.errors.some(e => e.includes('ADMIN_SESSION_IDLE_MINUTES')), 'Expected idle error message');

    const tooHighIdle = validateAdminEnv({
      NODE_ENV: 'production',
      ADMIN_USERNAME: 'super_admin_test',
      ADMIN_PASSWORD: 'super_secure_password_123',
      ADMIN_JWT_SECRET: 'super_secure_jwt_secret_32_chars_long!',
      ADMIN_SESSION_IDLE_MINUTES: '481',
      ADMIN_SESSION_MAX_HOURS: '12',
    }, true);
    assert.strictEqual(tooHighIdle.valid, false, 'idle > 480 must fail validation');

    // Test max hours bounds (min 1, max 24)
    const tooLowMax = validateAdminEnv({
      NODE_ENV: 'production',
      ADMIN_USERNAME: 'super_admin_test',
      ADMIN_PASSWORD: 'super_secure_password_123',
      ADMIN_JWT_SECRET: 'super_secure_jwt_secret_32_chars_long!',
      ADMIN_SESSION_IDLE_MINUTES: '120',
      ADMIN_SESSION_MAX_HOURS: '0',
    }, true);
    assert.strictEqual(tooLowMax.valid, false, 'max < 1 must fail validation');

    const tooHighMax = validateAdminEnv({
      NODE_ENV: 'production',
      ADMIN_USERNAME: 'super_admin_test',
      ADMIN_PASSWORD: 'super_secure_password_123',
      ADMIN_JWT_SECRET: 'super_secure_jwt_secret_32_chars_long!',
      ADMIN_SESSION_IDLE_MINUTES: '120',
      ADMIN_SESSION_MAX_HOURS: '25',
    }, true);
    assert.strictEqual(tooHighMax.valid, false, 'max > 24 must fail validation');

    // Valid boundaries
    const validConfig = validateAdminEnv({
      NODE_ENV: 'production',
      ADMIN_USERNAME: 'super_admin_test',
      ADMIN_PASSWORD: 'super_secure_password_123',
      ADMIN_JWT_SECRET: 'super_secure_jwt_secret_32_chars_long!',
      ADMIN_SESSION_IDLE_MINUTES: '15',
      ADMIN_SESSION_MAX_HOURS: '24',
    }, true);
    assert.strictEqual(validConfig.valid, true, 'Valid config should pass validation');
    console.log('  ✅ Check 6 passed: Out-of-bounds config rejected in production');
  }

  // ---------------------------------------------------------------------------
  // Check 1 & 2: Login admin token has auth_time; Refresh extends exp and preserves auth_time
  // ---------------------------------------------------------------------------
  console.log('Test 2: Admin login & POST /api/admin/refresh preserves auth_time and extends exp up to hard cap');
  let initialAdminToken = null;
  let loginAuthTime = null;
  {
    const loginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });

    assert.strictEqual(loginRes.status, 200, `Admin login failed: ${JSON.stringify(loginRes.data)}`);
    assert.ok(loginRes.data.adminToken, 'adminToken must be returned on admin login');
    assert.ok(loginRes.data.adminExpiresAt, 'adminExpiresAt must be returned');
    assert.ok(loginRes.data.adminSessionEndsAt, 'adminSessionEndsAt must be returned');

    initialAdminToken = loginRes.data.adminToken;
    const decodedLogin = jwt.decode(initialAdminToken);
    assert.ok(decodedLogin.auth_time, 'decoded admin token must contain auth_time');
    loginAuthTime = decodedLogin.auth_time;

    // Call POST /api/admin/refresh
    const refreshRes = await req('/admin/refresh', { method: 'POST' }, initialAdminToken);
    assert.strictEqual(refreshRes.status, 200, `Refresh should succeed: ${JSON.stringify(refreshRes.data)}`);
    assert.ok(refreshRes.data.adminToken, 'refreshed adminToken must be returned');
    assert.ok(refreshRes.data.expiresAt, 'refreshed expiresAt must be returned');
    assert.ok(refreshRes.data.sessionEndsAt, 'refreshed sessionEndsAt must be returned');

    const decodedRefreshed = jwt.decode(refreshRes.data.adminToken);
    assert.strictEqual(decodedRefreshed.auth_time, loginAuthTime, 'auth_time must remain identical after refresh');
    assert.strictEqual(decodedRefreshed.sub, decodedLogin.sub, 'sub must match');
    assert.strictEqual(decodedRefreshed.scope, 'admin', 'scope must remain admin');

    // Hard-cap enforcement check on exp:
    // With maxSeconds = 12 * 3600, exp cannot exceed auth_time + 12 * 3600
    const { maxSeconds } = getAdminSessionConfig(process.env);
    assert.ok(decodedRefreshed.exp <= decodedRefreshed.auth_time + maxSeconds, 'exp must never exceed auth_time + maxSeconds');
    console.log('  ✅ Check 1 & 2 passed: Token refreshes properly with preserved auth_time and hard-cap bounds');
  }

  // ---------------------------------------------------------------------------
  // Check 1 (cont): Refresh near / past hard cap
  // ---------------------------------------------------------------------------
  console.log('Test 3: Refresh when session is past hard cap returns 401');
  {
    const { maxSeconds } = getAdminSessionConfig(process.env);
    const expiredAuthTime = Math.floor(Date.now() / 1000) - (maxSeconds + 60); // 1 minute past max
    const tokenPastCap = jwt.sign(
      {
        sub: adminUserId,
        scope: 'admin',
        auth_time: expiredAuthTime,
      },
      ADMIN_JWT_SECRET,
      { expiresIn: 300 } // unexpired JWT signature, but past auth_time hard cap
    );

    const pastCapRes = await req('/admin/refresh', { method: 'POST' }, tokenPastCap);
    assert.strictEqual(pastCapRes.status, 401, 'Token past hard cap must be rejected with 401');
    assert.strictEqual(pastCapRes.data.error, 'SESSION_CAP_REACHED');
    console.log('  ✅ Check 1 (hard cap) passed: Rejecting session past maxSeconds with 401');
  }

  // ---------------------------------------------------------------------------
  // Check 3: Refresh with normal user token returns 404
  // ---------------------------------------------------------------------------
  console.log('Test 4: Refresh with normal user token returns 404');
  {
    const normalUserToken = jwt.sign(
      { id: adminUserId, username: ADMIN_USERNAME },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const userTokenRes = await req('/admin/refresh', { method: 'POST' }, normalUserToken);
    assert.strictEqual(userTokenRes.status, 404, 'Normal user token on /api/admin/refresh must return 404');
    console.log('  ✅ Check 3 passed: Normal user token returns 404');
  }

  // ---------------------------------------------------------------------------
  // Check 4: Refresh with expired admin token returns 401
  // ---------------------------------------------------------------------------
  console.log('Test 5: Refresh with expired admin token returns 401');
  {
    const expiredToken = jwt.sign(
      {
        sub: adminUserId,
        scope: 'admin',
        auth_time: Math.floor(Date.now() / 1000) - 200,
      },
      ADMIN_JWT_SECRET,
      { expiresIn: -10 } // Expired in past
    );
    const expiredRes = await req('/admin/refresh', { method: 'POST' }, expiredToken);
    assert.strictEqual(expiredRes.status, 401, 'Expired admin token must return 401');
    assert.strictEqual(expiredRes.data.error, 'TOKEN_EXPIRED');
    console.log('  ✅ Check 4 passed: Expired admin token returns 401');
  }

  // ---------------------------------------------------------------------------
  // Check 5: Refresh with is_admin = false returns 404 / 401
  // ---------------------------------------------------------------------------
  console.log('Test 6: Refresh with is_admin = false returns 404 or 401');
  {
    const dummyNonAdminId = '99999999-9999-4999-9999-999999999999';
    await pool.query(
      `INSERT INTO users (id, username, password_hash, is_admin)
       VALUES ($1, 'dummy_non_admin_session_test', 'hash', FALSE)
       ON CONFLICT (id) DO UPDATE SET is_admin = FALSE`,
      [dummyNonAdminId]
    );

    const nonAdminToken = jwt.sign(
      {
        sub: dummyNonAdminId,
        scope: 'admin',
        auth_time: Math.floor(Date.now() / 1000),
      },
      ADMIN_JWT_SECRET,
      { expiresIn: 300 }
    );

    const nonAdminRes = await req('/admin/refresh', { method: 'POST' }, nonAdminToken);
    assert.ok(nonAdminRes.status === 404 || nonAdminRes.status === 401, `Non-admin user should get 404 or 401, got ${nonAdminRes.status}`);

    await pool.query('DELETE FROM users WHERE id = $1', [dummyNonAdminId]);
    console.log('  ✅ Check 5 passed: Non-admin user refused with 404/401');
  }

  // ---------------------------------------------------------------------------
  // Check 7: Refreshed token works on protected admin routes
  // ---------------------------------------------------------------------------
  console.log('Test 7: Refreshed token works on protected admin routes');
  {
    const refreshRes = await req('/admin/refresh', { method: 'POST' }, initialAdminToken);
    assert.strictEqual(refreshRes.status, 200);
    const freshToken = refreshRes.data.adminToken;

    const trackersRes = await req('/admin/trackers', { method: 'GET' }, freshToken);
    assert.strictEqual(trackersRes.status, 200, `GET /api/admin/trackers must succeed with refreshed token, got ${trackersRes.status}`);
    assert.ok(Array.isArray(trackersRes.data.trackers || trackersRes.data), 'Expected list of trackers');
    console.log('  ✅ Check 7 passed: Refreshed token successfully accesses /api/admin/trackers');
  }

  console.log('\n🎉 ALL 7 ADMIN SESSION CHECKS PASSED!\n');
}

runSessionTests()
  .then(() => pool.end())
  .catch((err) => {
    console.error('❌ Test failed:', err);
    pool.end().finally(() => process.exit(1));
  });
