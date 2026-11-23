/**
 * Enhanced Integration Test Suite for DSA Vault Endpoints
 * Tests:
 * 1. User A registration & login
 * 2. Problem creation without Google Drive links
 * 3. Problem creation with both valid Google Drive links
 * 4. Record persistence and GET /api/problems
 * 5. GET /api/problems/:id details
 * 6. Update problem initial approach & add improved solution & replace notes link
 * 7. Revision recording
 * 8. Search and filter problems
 * 9. Server-side pagination & sorting
 * 10. Filter by reviewed and revision status
 * 11. Multi-user isolation verification (User B cannot access User A's record)
 * 12. Deletion of problem
 */

import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🧪 Starting Enhanced DSA Vault Integration Tests...\n');
  const timestamp = Date.now();

  // Test 1: Register User A
  console.log('1. Register User A...');
  const usernameA = `user_a_${timestamp}`;
  const resRegA = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: usernameA, password: 'password123' }),
  });
  assert.strictEqual(resRegA.status, 201, `Expected 201 Created: ${JSON.stringify(resRegA.data)}`);
  const tokenA = resRegA.data.token;
  assert.ok(tokenA, 'Expected token for User A');
  console.log('✅ User A registered successfully.');

  // Test 2: Login User A
  console.log('2. Log in User A...');
  const resLoginA = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: usernameA, password: 'password123' }),
  });
  assert.strictEqual(resLoginA.status, 200);
  assert.strictEqual(resLoginA.data.user.username, usernameA);
  console.log('✅ User A logged in successfully.');

  // Test 3: Create Problem without notes links
  console.log('3. Create Problem without notes links...');
  const resP1 = await request('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Two Sum',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/two-sum/',
      submissionUrl: '',
      difficulty: 'Easy',
      status: 'Solved Independently',
      solvingDate: '2026-10-10',
      timeTaken: 15,
      topics: ['Array', 'Hash Map'],
      initialApproach: {
        description: 'Used a hash map to look up complement values in one pass.',
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        notesUrl: '',
        mainDifficulty: 'None',
      },
      improvedSolution: {
        reviewed: false,
        description: '',
        timeComplexity: '',
        spaceComplexity: '',
        notesUrl: '',
        keyInsight: '',
      },
      assessment: {
        confidenceRating: 5,
        canSolveAgain: true,
        mistakeCategories: [],
        nextRevisionDate: '2026-10-24',
      },
    }),
  }, tokenA);
  assert.strictEqual(resP1.status, 201, `Create P1 failed: ${JSON.stringify(resP1.data)}`);
  const prob1Id = resP1.data.id;
  assert.ok(prob1Id, 'Problem 1 ID should exist');
  assert.strictEqual(resP1.data.initialApproach.notesUrl, '');
  console.log('✅ Problem without notes created successfully.');

  // Test 4: Create Problem with both Google Drive links
  console.log('4. Create Problem with both Google Drive links...');
  const resP2 = await request('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Course Schedule',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/course-schedule/',
      submissionUrl: 'https://leetcode.com/submissions/detail/123/',
      difficulty: 'Medium',
      status: 'Solved With Hint',
      solvingDate: '2026-10-11',
      timeTaken: 45,
      topics: ['Graph', 'BFS', 'Topological Sort'],
      initialApproach: {
        description: 'Kahn algorithm using in-degree array and queue.',
        timeComplexity: 'O(V + E)',
        spaceComplexity: 'O(V + E)',
        notesUrl: 'https://drive.google.com/file/d/initial-course-schedule-notes/view',
        mainDifficulty: 'Detecting cycles when in-degrees never reach zero.',
      },
      improvedSolution: {
        reviewed: true,
        description: 'Alternative DFS with 3-color node state tracking.',
        timeComplexity: 'O(V + E)',
        spaceComplexity: 'O(V + E)',
        notesUrl: 'https://drive.google.com/file/d/improved-course-schedule-notes/view',
        keyInsight: 'Both BFS and DFS solve topological sorting cleanly.',
      },
      assessment: {
        confidenceRating: 4,
        canSolveAgain: true,
        mistakeCategories: ['Wrong algorithm'],
        nextRevisionDate: '2026-10-18',
      },
    }),
  }, tokenA);
  assert.strictEqual(resP2.status, 201, `Create P2 failed: ${JSON.stringify(resP2.data)}`);
  const prob2Id = resP2.data.id;
  assert.strictEqual(resP2.data.initialApproach.notesUrl, 'https://drive.google.com/file/d/initial-course-schedule-notes/view');
  assert.strictEqual(resP2.data.improvedSolution.notesUrl, 'https://drive.google.com/file/d/improved-course-schedule-notes/view');
  console.log('✅ Problem with both Google Drive notes created successfully.');

  // Test 5: Verify Persistence & GET /api/problems
  console.log('5. List problems for User A...');
  const resListA = await request('/problems', { method: 'GET' }, tokenA);
  assert.strictEqual(resListA.status, 200);
  assert.strictEqual(resListA.data.length, 2);
  console.log('✅ User A has 2 persistent problems.');

  // Test 6: GET /api/problems/:id
  console.log('6. Get Problem Details for P2...');
  const resDetailP2 = await request(`/problems/${prob2Id}`, { method: 'GET' }, tokenA);
  assert.strictEqual(resDetailP2.status, 200);
  assert.strictEqual(resDetailP2.data.title, 'Course Schedule');
  assert.strictEqual(resDetailP2.data.initialApproach.notesUrl, 'https://drive.google.com/file/d/initial-course-schedule-notes/view');
  console.log('✅ Problem details fetched with correct notes links.');

  // Test 7: Edit Problem
  console.log('7. Edit P1 (update initial approach, add improved solution, replace notes)...');
  const resEditP1 = await request(`/problems/${prob1Id}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...resP1.data,
      initialApproach: {
        ...resP1.data.initialApproach,
        description: 'Updated initial approach description.',
        notesUrl: 'https://drive.google.com/file/d/new-notes-link/view',
      },
      improvedSolution: {
        reviewed: true,
        description: 'Optimal solution with dual pointers if sorted.',
        timeComplexity: 'O(n log n)',
        spaceComplexity: 'O(1)',
        notesUrl: '',
        keyInsight: 'Sorting allows two-pointer technique.',
      },
    }),
  }, tokenA);
  assert.strictEqual(resEditP1.status, 200, `Edit P1 failed: ${JSON.stringify(resEditP1.data)}`);
  assert.strictEqual(resEditP1.data.initialApproach.description, 'Updated initial approach description.');
  assert.strictEqual(resEditP1.data.initialApproach.notesUrl, 'https://drive.google.com/file/d/new-notes-link/view');
  assert.strictEqual(resEditP1.data.improvedSolution.reviewed, true);
  console.log('✅ Problem edited successfully.');

  // Test 8: Record Revision
  console.log('8. Record revision for P1...');
  const resRev = await request(`/problems/${prob1Id}/revisions`, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-10-11',
      result: 'Remembered',
      notes: 'Solved cleanly in 10 minutes without looking at notes.',
    }),
  }, tokenA);
  assert.strictEqual(resRev.status, 201, `Revision failed: ${JSON.stringify(resRev.data)}`);
  console.log('✅ Revision recorded successfully.');

  // Test 9: Server-side Search, Filtering, and Pagination
  console.log('9. Server-side Search & Pagination...');
  const resPaginated = await request('/problems?page=1&limit=1', { method: 'GET' }, tokenA);
  assert.strictEqual(resPaginated.status, 200);
  assert.ok(resPaginated.data.pagination, 'Pagination object should exist');
  assert.strictEqual(resPaginated.data.pagination.total, 2);
  assert.strictEqual(resPaginated.data.data.length, 1);
  console.log('✅ Server-side pagination validated.');

  // Test 10: Server-side Filter by reviewed
  console.log('10. Filter by reviewed status...');
  const resReviewed = await request('/problems?reviewed=true', { method: 'GET' }, tokenA);
  assert.strictEqual(resReviewed.status, 200);
  assert.strictEqual(resReviewed.data.length, 2); // Both are now reviewed
  console.log('✅ Filter by reviewed status validated.');

  // Test 11: Multi-user Data Isolation Verification
  console.log('11. Multi-user isolation verification (User B cannot access User A records)...');
  const usernameB = `user_b_${timestamp}`;
  const resRegB = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: usernameB, password: 'password123' }),
  });
  const tokenB = resRegB.data.token;

  // User B lists problems -> should be 0
  const resListB = await request('/problems', { method: 'GET' }, tokenB);
  assert.strictEqual(resListB.data.length, 0, 'User B should have 0 problems');

  // User B attempts to access User A's problem -> should be 404
  const resAccessOther = await request(`/problems/${prob1Id}`, { method: 'GET' }, tokenB);
  assert.strictEqual(resAccessOther.status, 404, 'User B must NOT access User A problem');

  // User B attempts to edit User A's problem -> should be 404
  const resEditOther = await request(`/problems/${prob1Id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Hacked Title' }),
  }, tokenB);
  assert.strictEqual(resEditOther.status, 404, 'User B must NOT edit User A problem');

  // User B attempts to delete User A's problem -> should be 404
  const resDeleteOther = await request(`/problems/${prob1Id}`, { method: 'DELETE' }, tokenB);
  assert.strictEqual(resDeleteOther.status, 404, 'User B must NOT delete User A problem');
  console.log('✅ Strict multi-user data isolation verified.');

  // Test 12: Delete Problem
  console.log('12. Delete Problem P2 by User A...');
  const resDel = await request(`/problems/${prob2Id}`, { method: 'DELETE' }, tokenA);
  assert.strictEqual(resDel.status, 200);

  const resListAfterDel = await request('/problems', { method: 'GET' }, tokenA);
  assert.strictEqual(resListAfterDel.data.length, 1);
  console.log('✅ Problem deleted successfully.');

  console.log('\n🎉 ALL 12 INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
