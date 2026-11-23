/**
 * Catalog Linking & Isolation Test Suite
 *
 * Covers:
 * 1. Manual entry without catalogId still works
 * 2. Create problem with valid catalogId returns catalogId
 * 3. Invalid catalogId (negative, non-numeric, or non-existent) returns 400
 * 4. Duplicate catalogId for the same user returns 409 DUPLICATE_PROBLEM with existing problem id
 * 5. User B can link the same catalog problem without conflict with User A (multi-tenant isolation)
 * 6. Updating problem with valid/duplicate catalogId on PUT /api/problems/:id
 */

import assert from 'assert';
import dotenv from 'dotenv';
import { pool } from '../db/pool.js';

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

async function runCatalogLinkTests() {
  console.log('🔗 Starting Catalog Linking & Duplicate Isolation Tests...\n');
  const timestamp = Date.now();

  // 1. Register User A and User B
  console.log('1. Registering test users (User A & User B)...');
  const userAName = `cat_user_a_${timestamp}`;
  const userBName = `cat_user_b_${timestamp}`;

  const regARes = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: userAName, password: 'Password123!' }),
  });
  assert.strictEqual(regARes.status, 201, `Failed to register User A: ${JSON.stringify(regARes.data)}`);
  const tokenA = regARes.data.token;
  const userAId = regARes.data.user.id;

  const regBRes = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: userBName, password: 'Password123!' }),
  });
  assert.strictEqual(regBRes.status, 201, `Failed to register User B: ${JSON.stringify(regBRes.data)}`);
  const tokenB = regBRes.data.token;
  const userBId = regBRes.data.user.id;
  console.log('  ✅ Users registered successfully.');

  // 2. Fetch catalog problems for testing
  console.log('2. Fetching catalog items #1 (Two Sum) and #2 (Add Two Numbers)...');
  const catRes1 = await req('/catalog?q=1', {}, tokenA);
  assert.strictEqual(catRes1.status, 200);
  assert.ok(catRes1.data.length > 0, 'Catalog #1 should exist');
  const cat1 = catRes1.data[0];

  const catRes2 = await req('/catalog?q=2', {}, tokenA);
  assert.strictEqual(catRes2.status, 200);
  assert.ok(catRes2.data.length > 0, 'Catalog #2 should exist');
  const cat2 = catRes2.data[0];
  console.log(`  ✅ Retrieved catalog items: #${cat1.lc_number} (ID: ${cat1.id}) and #${cat2.lc_number} (ID: ${cat2.id})`);

  // 3. Manual entry without catalogId still works
  console.log('3. Testing manual problem entry without catalogId...');
  const manualProblem = {
    title: 'Custom Problem Without Catalog Link',
    platform: 'HackerRank',
    difficulty: 'Medium',
    problemUrl: 'https://hackerrank.com/challenges/custom-prob',
    status: 'Solved Independently',
    solvingDate: '2026-11-23',
    timeTaken: 25,
  };
  const resManual = await req('/problems', {
    method: 'POST',
    body: JSON.stringify(manualProblem),
  }, tokenA);
  assert.strictEqual(resManual.status, 201, `Expected 201: ${JSON.stringify(resManual.data)}`);
  assert.strictEqual(resManual.data.catalogId, null, 'Manual problem should have null catalogId');
  const manualId = resManual.data.id;

  const getManual = await req(`/problems/${manualId}`, {}, tokenA);
  assert.strictEqual(getManual.status, 200);
  assert.strictEqual(getManual.data.catalogId, null);
  console.log('  ✅ Manual entry without catalogId works cleanly (catalogId: null)');

  // 4. Create problem with valid catalogId
  console.log('4. Testing create problem with valid catalogId...');
  const linkedProblemA1 = {
    title: cat1.title,
    platform: 'LeetCode',
    difficulty: cat1.difficulty,
    problemUrl: cat1.url,
    status: 'Solved Independently',
    solvingDate: '2026-11-23',
    timeTaken: 30,
    catalogId: cat1.id,
  };
  const resCreateA1 = await req('/problems', {
    method: 'POST',
    body: JSON.stringify(linkedProblemA1),
  }, tokenA);
  assert.strictEqual(resCreateA1.status, 201, `Expected 201: ${JSON.stringify(resCreateA1.data)}`);
  assert.strictEqual(resCreateA1.data.catalogId, cat1.id, 'Response should contain catalogId');
  const problemA1Id = resCreateA1.data.id;

  const getA1 = await req(`/problems/${problemA1Id}`, {}, tokenA);
  assert.strictEqual(getA1.status, 200);
  assert.strictEqual(getA1.data.catalogId, cat1.id, 'GET problem details must return catalogId');
  console.log('  ✅ Problem created with valid catalogId and returned properly in responses.');

  // 5. Invalid catalogId -> 400
  console.log('5. Testing invalid catalogId returns 400...');
  // Non-positive integer
  const resNegative = await req('/problems', {
    method: 'POST',
    body: JSON.stringify({ ...linkedProblemA1, catalogId: -1 }),
  }, tokenA);
  assert.strictEqual(resNegative.status, 400, 'Negative catalogId should return 400');

  // Non-integer string
  const resString = await req('/problems', {
    method: 'POST',
    body: JSON.stringify({ ...linkedProblemA1, catalogId: 'not-an-integer' }),
  }, tokenA);
  assert.strictEqual(resString.status, 400, 'String catalogId should return 400');

  // Non-existent catalogId
  const resNonExistent = await req('/problems', {
    method: 'POST',
    body: JSON.stringify({ ...linkedProblemA1, catalogId: 99999999 }),
  }, tokenA);
  assert.strictEqual(resNonExistent.status, 400, 'Non-existent catalogId should return 400');

  // PUT with non-existent catalogId
  const resPutInvalid = await req(`/problems/${problemA1Id}`, {
    method: 'PUT',
    body: JSON.stringify({ catalogId: 99999999 }),
  }, tokenA);
  assert.strictEqual(resPutInvalid.status, 400, 'PUT with non-existent catalogId should return 400');
  console.log('  ✅ Invalid catalogId rejected with 400 across negative, non-numeric, and non-existent IDs.');

  // 6. Duplicate catalogId for User A -> 409 DUPLICATE_PROBLEM with existing problem id
  console.log('6. Testing duplicate catalogId returns 409 DUPLICATE_PROBLEM...');
  const resDupA = await req('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Two Sum Duplicate Attempt',
      platform: 'LeetCode',
      difficulty: 'Easy',
      problemUrl: cat1.url,
      status: 'Solved With Hint',
      solvingDate: '2026-11-23',
      catalogId: cat1.id,
    }),
  }, tokenA);
  assert.strictEqual(resDupA.status, 409, `Expected 409 Conflict: ${JSON.stringify(resDupA.data)}`);
  assert.strictEqual(resDupA.data.error, 'DUPLICATE_PROBLEM', 'Error code must be DUPLICATE_PROBLEM');
  const returnedProblemId = resDupA.data.problemId || resDupA.data.id;
  assert.strictEqual(returnedProblemId, problemA1Id, 'Must return existing problem id');

  // Create problem 2 with cat2
  const resCreateA2 = await req('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: cat2.title,
      platform: 'LeetCode',
      difficulty: cat2.difficulty,
      problemUrl: cat2.url,
      status: 'Solved Independently',
      solvingDate: '2026-11-23',
      catalogId: cat2.id,
    }),
  }, tokenA);
  assert.strictEqual(resCreateA2.status, 201);
  const problemA2Id = resCreateA2.data.id;

  // Try updating problem 2 to have catalogId of problem 1 -> 409
  const resPutDup = await req(`/problems/${problemA2Id}`, {
    method: 'PUT',
    body: JSON.stringify({ catalogId: cat1.id }),
  }, tokenA);
  assert.strictEqual(resPutDup.status, 409, 'Updating to duplicate catalogId must return 409');
  assert.strictEqual(resPutDup.data.error, 'DUPLICATE_PROBLEM');
  console.log('  ✅ Duplicate catalogId correctly returns 409 DUPLICATE_PROBLEM with existing problem id.');

  // 7. User B can link the same catalog problem without conflict with User A
  console.log('7. Testing User B can link the same catalog problem without conflict...');
  const resCreateB1 = await req('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: cat1.title,
      platform: 'LeetCode',
      difficulty: cat1.difficulty,
      problemUrl: cat1.url,
      status: 'Solved Independently',
      solvingDate: '2026-11-23',
      catalogId: cat1.id,
    }),
  }, tokenB);
  assert.strictEqual(resCreateB1.status, 201, `User B creation should succeed: ${JSON.stringify(resCreateB1.data)}`);
  assert.strictEqual(resCreateB1.data.catalogId, cat1.id);
  assert.notStrictEqual(resCreateB1.data.id, problemA1Id, 'User B problem must have distinct ID from User A');

  // But User B cannot link the same problem a second time
  const resDupB = await req('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'User B duplicate attempt',
      platform: 'LeetCode',
      difficulty: cat1.difficulty,
      problemUrl: cat1.url,
      status: 'Solved With Help',
      solvingDate: '2026-11-23',
      catalogId: cat1.id,
    }),
  }, tokenB);
  assert.strictEqual(resDupB.status, 409);
  assert.strictEqual(resDupB.data.error, 'DUPLICATE_PROBLEM');
  assert.strictEqual(resDupB.data.problemId || resDupB.data.id, resCreateB1.data.id);
  console.log('  ✅ Multi-tenant isolation verified: User B linked problem #1 without conflict with User A.');

  // 8. Cleanup test users
  console.log('8. Cleaning up test users...');
  try {
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [userAId, userBId]);
    console.log('  ✅ Cleanup complete.');
  } catch (err) {
    console.warn('  ⚠️ Warning during cleanup:', err.message);
  }

  console.log('\n🎉 ALL CATALOG LINKING & ISOLATION TESTS PASSED!\n');
}

runCatalogLinkTests()
  .then(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Catalog Link Tests Failed:', err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
