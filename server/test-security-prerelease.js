import assert from 'assert';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_change_in_production';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

async function runSecurityPreReleaseTests() {
  console.log('🔒 Starting Pre-Release Security & Robustness Audit Test Suite...\n');

  // ────────────────────────────────────────────────────────────────────────────
  // 1. UNAUTHORIZED REQUESTS & TOKEN VALIDATION
  // ────────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Testing Unauthorized Requests & Token Validation ---');
  
  // 1.1 Missing Authorization Header
  const noAuth = await req('/problems');
  assert.strictEqual(noAuth.status, 401, 'Request without auth should return 401');
  assert.strictEqual(noAuth.data?.error, 'UNAUTHORIZED');
  console.log('  ✅ Missing auth header rejected with 401 UNAUTHORIZED');

  // 1.2 Malformed Authorization Header (No Bearer prefix)
  const malformedHeader = await req('/problems', {
    headers: { Authorization: 'Basic somecredentials' },
  });
  assert.strictEqual(malformedHeader.status, 401, 'Malformed auth header should return 401');
  console.log('  ✅ Malformed auth header rejected with 401');

  // 1.3 Forged / Invalid Signature JWT
  const forgedToken = jwt.sign({ id: 'fake-user', username: 'attacker' }, 'wrong_secret_key_123');
  const invalidSig = await req('/problems', {
    headers: { Authorization: `Bearer ${forgedToken}` },
  });
  assert.strictEqual(invalidSig.status, 401, 'Forged JWT signature should return 401');
  assert.strictEqual(invalidSig.data?.error, 'INVALID_TOKEN');
  console.log('  ✅ Forged JWT token signature rejected with 401 INVALID_TOKEN');

  // 1.4 Expired JWT
  const expiredToken = jwt.sign(
    { id: 'expired-user', username: 'expired' },
    JWT_SECRET,
    { expiresIn: -10 } // Expired 10 seconds ago
  );
  const expiredRes = await req('/problems', {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert.strictEqual(expiredRes.status, 401, 'Expired JWT should return 401');
  assert.strictEqual(expiredRes.data?.error, 'TOKEN_EXPIRED');
  console.log('  ✅ Expired JWT rejected with 401 TOKEN_EXPIRED');

  // ────────────────────────────────────────────────────────────────────────────
  // 2. INPUT VALIDATION & UNSAFE SCHEMES (Negative Testing)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Input Validation & Scheme Rejection ---');

  // Register User A
  const ts = Date.now();
  const userA = `sec_user_a_${ts}`;
  const regA = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: userA, password: 'Password123!' }),
  });
  assert.strictEqual(regA.status, 201, 'User A should register');
  const tokenA = regA.data.token;
  const authA = { Authorization: `Bearer ${tokenA}` };

  // 2.1 Registration validations
  const shortUser = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: 'ab', password: 'Password123!' }),
  });
  assert.strictEqual(shortUser.status, 400, 'Username < 3 chars should return 400');
  console.log('  ✅ Registration: short username rejected with 400');

  const invalidUserChar = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: 'user@name!', password: 'Password123!' }),
  });
  assert.strictEqual(invalidUserChar.status, 400, 'Invalid username chars should return 400');
  console.log('  ✅ Registration: invalid username characters rejected with 400');

  const shortPass = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: `valid_${ts}`, password: 'short' }),
  });
  assert.strictEqual(shortPass.status, 400, 'Password < 8 chars should return 400');
  console.log('  ✅ Registration: short password rejected with 400');

  // 2.2 Duplicate registration
  const dupReg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: userA, password: 'Password123!' }),
  });
  assert.strictEqual(dupReg.status, 409, 'Duplicate username should return 409');
  assert.strictEqual(dupReg.data?.error, 'USERNAME_TAKEN');
  console.log('  ✅ Registration: duplicate username rejected with 409 USERNAME_TAKEN');

  // 2.3 Problem Creation: Missing required title
  const missingTitle = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      platform: 'LeetCode',
      difficulty: 'Medium',
      problemUrl: 'https://leetcode.com/problems/test',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
    }),
  });
  assert.strictEqual(missingTitle.status, 400, 'Missing title should return 400');
  console.log('  ✅ Problem creation: missing title rejected with 400');

  // 2.4 Problem Creation: Invalid difficulty
  const invalidDiff = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'Bad Difficulty Problem',
      platform: 'LeetCode',
      difficulty: 'SuperExtreme',
      problemUrl: 'https://leetcode.com/problems/test',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
    }),
  });
  assert.strictEqual(invalidDiff.status, 400, 'Invalid difficulty should return 400');
  console.log('  ✅ Problem creation: invalid difficulty rejected with 400');

  // 2.5 Problem Creation: Unsafe javascript: scheme in Problem URL
  const jsProbUrl = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'XSS Problem URL',
      platform: 'LeetCode',
      difficulty: 'Medium',
      problemUrl: 'javascript:alert(document.cookie)',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
    }),
  });
  assert.strictEqual(jsProbUrl.status, 400, 'javascript: in problem URL should return 400');
  console.log('  ✅ Problem creation: unsafe javascript: problemUrl rejected with 400');

  // 2.6 Problem Creation: Unsafe javascript: scheme in Notes URL
  const jsNotesUrl = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'XSS Notes URL',
      platform: 'LeetCode',
      difficulty: 'Medium',
      problemUrl: 'https://leetcode.com/problems/test',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
      initialApproach: {
        notesUrl: 'javascript:alert(1)',
      },
    }),
  });
  assert.strictEqual(jsNotesUrl.status, 400, 'javascript: in notesUrl should return 400');
  console.log('  ✅ Problem creation: unsafe javascript: notesUrl rejected with 400');

  // 2.7 Problem Creation: Non-Google-Drive domain in Notes URL
  const badDriveDomain = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'Invalid Domain Notes',
      platform: 'LeetCode',
      difficulty: 'Medium',
      problemUrl: 'https://leetcode.com/problems/test',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
      initialApproach: {
        notesUrl: 'https://attacker.com/malicious-doc',
      },
    }),
  });
  assert.strictEqual(badDriveDomain.status, 400, 'Non-Google Drive notes URL should return 400');
  console.log('  ✅ Problem creation: non-Google Drive notes link rejected with 400');

  // 2.8 Problem Creation: Negative timeTaken
  const negTime = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'Negative Time',
      platform: 'LeetCode',
      difficulty: 'Medium',
      problemUrl: 'https://leetcode.com/problems/test',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
      timeTaken: -15,
    }),
  });
  assert.strictEqual(negTime.status, 400, 'Negative timeTaken should return 400');
  console.log('  ✅ Problem creation: negative timeTaken rejected with 400');

  // ────────────────────────────────────────────────────────────────────────────
  // 3. CROSS-USER RESOURCE ISOLATION & IDOR DEFENSE
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Cross-User Isolation (IDOR Defense) ---');

  // Create a legitimate problem for User A
  const createA = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: 'Valid Problem A',
      platform: 'LeetCode',
      difficulty: 'Medium',
      problemUrl: 'https://leetcode.com/problems/valid-problem-a',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
      topics: ['Array', 'Two Pointers'],
      initialApproach: {
        description: 'Initial two pointer method',
        notesUrl: 'https://drive.google.com/file/d/test-doc-id/view',
      },
      improvedSolution: {
        reviewed: true,
        description: 'Optimal solution',
        notesUrl: 'https://docs.google.com/document/d/optimal-id/edit',
      },
      assessment: {
        confidenceRating: 4,
        nextRevisionDate: '2026-10-14',
      },
    }),
  });
  assert.strictEqual(createA.status, 201, 'Problem A should be created');
  const probAId = createA.data.id;
  console.log(`  ✅ Problem A created with ID: ${probAId}`);

  // Register User B
  const userB = `sec_user_b_${ts}`;
  const regB = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: userB, password: 'Password123!' }),
  });
  assert.strictEqual(regB.status, 201, 'User B should register');
  const tokenB = regB.data.token;
  const authB = { Authorization: `Bearer ${tokenB}` };

  // 3.1 User B attempts to GET User A's problem
  const getForbidden = await req(`/problems/${probAId}`, {
    method: 'GET',
    headers: authB,
  });
  assert.strictEqual(getForbidden.status, 404, 'User B must get 404 when requesting User A problem');
  console.log('  ✅ User B GET User A problem -> 404 NOT_FOUND');

  // 3.2 User B attempts to PUT / update User A's problem
  const putForbidden = await req(`/problems/${probAId}`, {
    method: 'PUT',
    headers: authB,
    body: JSON.stringify({ title: 'Hacked Title By User B' }),
  });
  assert.strictEqual(putForbidden.status, 404, 'User B update on User A problem -> 404');
  console.log('  ✅ User B PUT User A problem -> 404 NOT_FOUND');

  // 3.3 User B attempts to DELETE User A's problem
  const deleteForbidden = await req(`/problems/${probAId}`, {
    method: 'DELETE',
    headers: authB,
  });
  assert.strictEqual(deleteForbidden.status, 404, 'User B delete on User A problem -> 404');
  console.log('  ✅ User B DELETE User A problem -> 404 NOT_FOUND');

  // 3.4 User B attempts to record a revision for User A's problem
  const revForbidden = await req(`/problems/${probAId}/revisions`, {
    method: 'POST',
    headers: authB,
    body: JSON.stringify({
      result: 'Solved Independently',
      date: '2026-10-11',
    }),
  });
  assert.strictEqual(revForbidden.status, 404, 'User B revision on User A problem -> 404');
  console.log('  ✅ User B record revision on User A problem -> 404 NOT_FOUND');

  // 3.5 User B attempts to reschedule User A's problem
  const reschedForbidden = await req(`/problems/${probAId}/reschedule`, {
    method: 'POST',
    headers: authB,
    body: JSON.stringify({ nextRevisionDate: '2026-12-31' }),
  });
  assert.strictEqual(reschedForbidden.status, 404, 'User B reschedule on User A problem -> 404');
  console.log('  ✅ User B reschedule User A problem -> 404 NOT_FOUND');

  // 3.6 Verify User A's problem is completely unmodified
  const getOrig = await req(`/problems/${probAId}`, {
    method: 'GET',
    headers: authA,
  });
  assert.strictEqual(getOrig.status, 200);
  assert.strictEqual(getOrig.data.title, 'Valid Problem A');
  assert.strictEqual(getOrig.data.assessment.nextRevisionDate, '2026-10-14');
  console.log('  ✅ User A problem data verified unaltered after malicious access attempts');

  // ────────────────────────────────────────────────────────────────────────────
  // 4. MISSING RECORDS (404 HANDLING)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing Missing Records ---');
  const nonExistentId = 'non_existent_id_99999999';
  const getMissing = await req(`/problems/${nonExistentId}`, { headers: authA });
  assert.strictEqual(getMissing.status, 404);

  const putMissing = await req(`/problems/${nonExistentId}`, {
    method: 'PUT',
    headers: authA,
    body: JSON.stringify({ title: 'New' }),
  });
  assert.strictEqual(putMissing.status, 404);

  const deleteMissing = await req(`/problems/${nonExistentId}`, {
    method: 'DELETE',
    headers: authA,
  });
  assert.strictEqual(deleteMissing.status, 404);
  console.log('  ✅ Missing records return clean 404 NOT_FOUND across GET, PUT, DELETE');

  // ────────────────────────────────────────────────────────────────────────────
  // 5. SQL INJECTION RESISTANCE & SEARCH SANITIZATION
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Testing SQL Injection Resistance ---');
  
  // Search query containing SQL injection payload
  const sqlSearch = await req('/problems?search=' + encodeURIComponent("' OR '1'='1' --"), {
    headers: authA,
  });
  assert.strictEqual(sqlSearch.status, 200, 'SQL injection in search should return 200 cleanly without error');
  // It should safely treat the payload as a string literal and return 0 results
  const foundItems = sqlSearch.data?.data || sqlSearch.data || [];
  assert.strictEqual(foundItems.length, 0, 'SQL injection search must not dump table data');
  console.log('  ✅ SQL injection string in search query safely handled with parameterized query');

  // Problem creation with quotes and symbols
  const sqlTitleProb = await req('/problems', {
    method: 'POST',
    headers: authA,
    body: JSON.stringify({
      title: "Robert'); DROP TABLE problems;--",
      platform: 'LeetCode',
      difficulty: 'Hard',
      problemUrl: 'https://leetcode.com/problems/drop-table',
      status: 'Solved Independently',
      solvingDate: '2026-10-11',
    }),
  });
  assert.strictEqual(sqlTitleProb.status, 201, 'Title with SQL characters stored safely');
  assert.strictEqual(sqlTitleProb.data.title, "Robert'); DROP TABLE problems;--");
  console.log('  ✅ SQL characters in title stored and retrieved safely without execution');

  // Clean up test problem
  await req(`/problems/${sqlTitleProb.data.id}`, { method: 'DELETE', headers: authA });
  await req(`/problems/${probAId}`, { method: 'DELETE', headers: authA });

  // ────────────────────────────────────────────────────────────────────────────
  // 6. SENSITIVE DATA EXPOSURE AUDIT
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Auditing Sensitive Data Exposure ---');
  
  // Login response must not include passwordHash
  const loginRes = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: userA, password: 'Password123!' }),
  });
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginRes.data.user.passwordHash, undefined, 'passwordHash must never be returned');
  assert.strictEqual(loginRes.data.user.password_hash, undefined, 'password_hash must never be returned');
  console.log('  ✅ Auth login response contains no passwordHash or password_hash');

  const meRes = await req('/auth/me', { headers: authA });
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meRes.data.user.passwordHash, undefined);
  assert.strictEqual(meRes.data.user.password_hash, undefined);
  console.log('  ✅ /auth/me endpoint contains no sensitive password hashes');

  console.log('\n🎉 ALL PRE-RELEASE SECURITY & NEGATIVE TESTS PASSED (100% SUCCESS)!');
}

runSecurityPreReleaseTests().catch((err) => {
  console.error('\n❌ Security test failed:', err);
  process.exit(1);
});
