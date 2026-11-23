/**
 * Catalog Search & Import Test Suite
 *
 * Verifies:
 * 1. Unauthenticated request is rejected (401)
 * 2. Search "1" and "two sum" both return lc_number 1
 * 3. Search "15" returns 15 and "3sum" returns the same row
 * 4. Re-running the import twice leaves the row count unchanged
 * 5. A title containing % or _ does not behave as a wildcard
 * 6. Empty search string returns []
 */

import assert from 'assert';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { importCatalog } from '../scripts/import-catalog.js';

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'bjn4C0K9saus9CP6rdmmm877te3ImsloZV2xmIcDB/o=';

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

async function runCatalogTests() {
  console.log('📚 Starting Problem Catalog Test Suite...\n');

  // ────────────────────────────────────────────────────────────────────────────
  // 1. Unauthenticated request is rejected
  // ────────────────────────────────────────────────────────────────────────────
  console.log('1. Testing unauthenticated requests are rejected...');
  const resNoAuth = await req('/catalog?q=1');
  assert.strictEqual(resNoAuth.status, 401, 'Request without auth token must return 401');
  assert.strictEqual(resNoAuth.data?.error, 'UNAUTHORIZED');

  const resInvalidAuth = await req('/catalog?q=two+sum', {}, 'invalid-dummy-jwt-token');
  assert.strictEqual(resInvalidAuth.status, 401, 'Request with invalid token must return 401');
  console.log('  ✅ Unauthenticated request rejected with 401 UNAUTHORIZED');

  // ────────────────────────────────────────────────────────────────────────────
  // Obtain authentication token
  // ────────────────────────────────────────────────────────────────────────────
  const resLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'demo', password: 'demo1234' }),
  });
  let token = resLogin.data?.token;
  if (!token) {
    token = jwt.sign(
      { id: '00000000-0000-0000-0000-000000000001', username: 'demo' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 2. Empty query returns []
  // ────────────────────────────────────────────────────────────────────────────
  console.log('2. Testing empty and whitespace queries return []...');
  const resEmpty = await req('/catalog?q=', {}, token);
  assert.strictEqual(resEmpty.status, 200);
  assert.deepStrictEqual(resEmpty.data, []);

  const resWhitespace = await req('/catalog?q=%20%20', {}, token);
  assert.strictEqual(resWhitespace.status, 200);
  assert.deepStrictEqual(resWhitespace.data, []);
  console.log('  ✅ Empty query correctly returns []');

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Search "1" and "two sum" both return lc_number 1
  // ────────────────────────────────────────────────────────────────────────────
  console.log('3. Testing search "1" and "two sum" both return lc_number 1...');
  const resDigit1 = await req('/catalog?q=1', {}, token);
  assert.strictEqual(resDigit1.status, 200);
  assert.ok(Array.isArray(resDigit1.data), 'Expected array response');
  assert.strictEqual(resDigit1.data.length, 1, 'Expected exactly 1 result for lc_number 1');
  assert.strictEqual(resDigit1.data[0].lc_number, 1);
  assert.strictEqual(resDigit1.data[0].slug, 'two-sum');
  assert.strictEqual(resDigit1.data[0].url, 'https://leetcode.com/problems/two-sum/');

  const resTwoSum = await req('/catalog?q=two%20sum', {}, token);
  assert.strictEqual(resTwoSum.status, 200);
  assert.ok(Array.isArray(resTwoSum.data));
  const matchTwoSum = resTwoSum.data.find((item) => item.lc_number === 1);
  assert.ok(matchTwoSum, 'Expected to find problem #1 in results for "two sum"');
  assert.strictEqual(matchTwoSum.title, 'Two Sum');
  assert.strictEqual(matchTwoSum.url, 'https://leetcode.com/problems/two-sum/');
  console.log('  ✅ Search "1" and "two sum" both return lc_number 1 with computed URL');

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Search "15" returns 15 and "3sum" returns the same row
  // ────────────────────────────────────────────────────────────────────────────
  console.log('4. Testing search "15" returns 15 and "3sum" returns the same row...');
  const res15 = await req('/catalog?q=15', {}, token);
  assert.strictEqual(res15.status, 200);
  assert.ok(Array.isArray(res15.data));
  assert.strictEqual(res15.data.length, 1);
  assert.strictEqual(res15.data[0].lc_number, 15);
  assert.strictEqual(res15.data[0].slug, '3sum');
  assert.strictEqual(res15.data[0].url, 'https://leetcode.com/problems/3sum/');

  const res3Sum = await req('/catalog?q=3sum', {}, token);
  assert.strictEqual(res3Sum.status, 200);
  assert.ok(Array.isArray(res3Sum.data));
  const match3Sum = res3Sum.data.find((item) => item.lc_number === 15);
  assert.ok(match3Sum, 'Expected to find problem #15 in results for "3sum"');
  assert.strictEqual(match3Sum.id, res15.data[0].id, 'Both queries must return the same row');
  assert.strictEqual(match3Sum.slug, res15.data[0].slug);
  assert.strictEqual(match3Sum.url, 'https://leetcode.com/problems/3sum/');
  console.log('  ✅ Search "15" returns 15 and "3sum" returns the same row');

  // ────────────────────────────────────────────────────────────────────────────
  // 5. Title containing % or _ does not behave as a wildcard
  // ────────────────────────────────────────────────────────────────────────────
  console.log('5. Testing % and _ in query do not act as wildcards...');
  // Underscore: "two_sum" should NOT match "Two Sum" when _ is escaped
  const resUnderscore = await req('/catalog?q=two_sum', {}, token);
  assert.strictEqual(resUnderscore.status, 200);
  const falseMatchUnderscore = resUnderscore.data.find((item) => item.lc_number === 1);
  assert.strictEqual(
    falseMatchUnderscore,
    undefined,
    '"two_sum" must not match "Two Sum" because _ is treated literally'
  );

  // Percent: "Two%Sum" should NOT match "Two Sum" when % is escaped
  const resPercent = await req('/catalog?q=Two%25Sum', {}, token);
  assert.strictEqual(resPercent.status, 200);
  const falseMatchPercent = resPercent.data.find((item) => item.lc_number === 1);
  assert.strictEqual(
    falseMatchPercent,
    undefined,
    '"Two%Sum" must not match "Two Sum" because % is treated literally'
  );

  // Bare percent should only match titles containing literal %
  const resBarePercent = await req('/catalog?q=%25', {}, token);
  assert.strictEqual(resBarePercent.status, 200);
  for (const item of resBarePercent.data) {
    assert.ok(
      item.title.includes('%'),
      `Result "${item.title}" should contain literal % character`
    );
  }

  // Insert test row with literal % and _
  await pool.query(
    `INSERT INTO catalog_problems (lc_number, title, slug, difficulty, topic_tags)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (lc_number) DO UPDATE SET title = EXCLUDED.title, slug = EXCLUDED.slug`,
    [999999, 'Test 100% Wild_Card Problem', 'test-wildcard-problem', 'Easy', null]
  );

  const resLiteralPercent = await req('/catalog?q=100%25', {}, token);
  assert.strictEqual(resLiteralPercent.status, 200);
  assert.ok(
    resLiteralPercent.data.some((r) => r.lc_number === 999999),
    'Should find row matching literal 100%'
  );

  const resLiteralUnderscore = await req('/catalog?q=Wild_Card', {}, token);
  assert.strictEqual(resLiteralUnderscore.status, 200);
  assert.ok(
    resLiteralUnderscore.data.some((r) => r.lc_number === 999999),
    'Should find row matching literal Wild_Card'
  );

  // Clean up test row
  await pool.query('DELETE FROM catalog_problems WHERE lc_number = 999999');
  console.log('  ✅ % and _ do not behave as wildcards (escaped and matched literally)');

  // ────────────────────────────────────────────────────────────────────────────
  // 6. Re-running the import twice leaves the row count unchanged
  // ────────────────────────────────────────────────────────────────────────────
  console.log('6. Testing re-running import twice leaves row count unchanged...');
  const { rows: countBeforeRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM catalog_problems'
  );
  const countBefore = countBeforeRows[0].count;

  // Run import again
  const importResult = await importCatalog('data/leetcode_problem_set.csv', { closePool: false });
  assert.strictEqual(importResult.skipped, 0, 'No valid rows should be skipped');

  const { rows: countAfterRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM catalog_problems'
  );
  const countAfter = countAfterRows[0].count;

  assert.strictEqual(
    countBefore,
    countAfter,
    `Row count changed: was ${countBefore}, now ${countAfter}`
  );
  console.log(`  ✅ Row count remained identical (${countAfter} rows) after re-import`);

  console.log('\n🎉 All Catalog Tests Passed Successfully!\n');
}

runCatalogTests()
  .then(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ Catalog Tests Failed:', err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
