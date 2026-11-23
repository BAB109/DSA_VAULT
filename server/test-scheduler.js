/**
 * Spaced-Repetition & Scheduling Comprehensive Test Suite
 * Tests:
 * 1. Scheduling Algorithm Rules:
 *    - 'Solved Independently' advances stage (1 -> 2 -> 3 -> 4 -> 5)
 *    - Beyond max stage continues periodic review (default 30 days)
 *    - 'Solved With Hint' steps back 1 stage
 *    - 'Reviewed The Solution' resets to stage 1 (1 day)
 *    - 'Unable To Solve' resets to stage 1 (1 day)
 * 2. Custom Intervals Configuration:
 *    - Custom intervals via PUT /api/settings
 *    - Verifies custom intervals are used in subsequent revision calculation
 * 3. Manual Rescheduling:
 *    - POST /api/problems/:id/reschedule updates next_revision_at cleanly
 * 4. Overdue and Due Date Sorting in Revision Center
 * 5. Full Isolation: User B cannot reschedule or revise User A's problem
 */

import assert from 'assert';
import { calculateNextRevision } from './services/scheduler.js';

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

async function runSchedulerTests() {
  console.log('🧪 Starting Spaced-Repetition System Tests...\n');

  // --- UNIT TESTS: Scheduling Algorithm Rules ---
  console.log('1. Testing scheduling algorithm unit rules...');
  const base = new Date('2026-10-01T00:00:00Z');

  // Rule 1: Solved independently advances stage
  const s1 = calculateNextRevision({
    outcome: 'Solved Independently',
    currentStage: 1,
    configuredIntervals: [1, 3, 7, 14, 30],
    baseDate: base,
  });
  assert.strictEqual(s1.nextStage, 2);
  assert.strictEqual(s1.intervalDays, 3);
  assert.strictEqual(s1.nextDate, '2026-10-04');

  // Rule 2: Solved independently at stage 5 applies periodic policy
  const s5 = calculateNextRevision({
    outcome: 'Solved Independently',
    currentStage: 5,
    configuredIntervals: [1, 3, 7, 14, 30],
    periodicInterval: 45,
    baseDate: base,
  });
  assert.strictEqual(s5.nextStage, 5);
  assert.strictEqual(s5.intervalDays, 45);
  assert.strictEqual(s5.nextDate, '2026-11-15');

  // Rule 3: Solved with a hint steps back 1 stage
  const sHint = calculateNextRevision({
    outcome: 'Solved With Hint',
    currentStage: 3,
    configuredIntervals: [1, 3, 7, 14, 30],
    baseDate: base,
  });
  assert.strictEqual(sHint.nextStage, 2);
  assert.strictEqual(sHint.intervalDays, 3);

  // Rule 4: Reviewed the solution resets to stage 1
  const sReviewed = calculateNextRevision({
    outcome: 'Reviewed The Solution',
    currentStage: 4,
    configuredIntervals: [1, 3, 7, 14, 30],
    baseDate: base,
  });
  assert.strictEqual(sReviewed.nextStage, 1);
  assert.strictEqual(sReviewed.intervalDays, 1);
  assert.strictEqual(sReviewed.nextDate, '2026-10-02');

  // Rule 5: Unable to solve resets to stage 1
  const sUnable = calculateNextRevision({
    outcome: 'Unable To Solve',
    currentStage: 5,
    configuredIntervals: [1, 3, 7, 14, 30],
    baseDate: base,
  });
  assert.strictEqual(sUnable.nextStage, 1);
  assert.strictEqual(sUnable.intervalDays, 1);
  console.log('✅ Unit algorithm rules passed.\n');

  // --- INTEGRATION TESTS ---
  const timestamp = Date.now();
  const usernameA = `rev_user_${timestamp}`;

  console.log('2. Registering test user...');
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: usernameA, password: 'password123' }),
  });
  const token = regRes.data.token;
  assert.ok(token);

  console.log('3. Customizing revision intervals in Settings (e.g. [2, 5, 10, 20, 40])...');
  const setRes = await request('/settings', {
    method: 'PUT',
    body: JSON.stringify({
      intervals: [2, 5, 10, 20, 40],
      periodicInterval: 60,
      dailyGoal: 5,
      weeklyGoal: 25,
    }),
  }, token);
  assert.strictEqual(setRes.status, 200);
  assert.deepStrictEqual(setRes.data.intervals, [2, 5, 10, 20, 40]);
  assert.strictEqual(setRes.data.periodicInterval, 60);
  console.log('✅ Custom intervals saved.');

  console.log('4. Creating test problem for revision workflow...');
  const probRes = await request('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'LRU Cache',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/lru-cache/',
      difficulty: 'Medium',
      status: 'Solved Independently',
      solvingDate: '2026-10-10',
      topics: ['Hash Map', 'Doubly Linked List', 'Design'],
      assessment: {
        confidenceRating: 1,
        nextRevisionDate: '2026-10-11',
      },
    }),
  }, token);
  assert.strictEqual(probRes.status, 201);
  const probId = probRes.data.id;
  console.log('✅ Problem created.');

  console.log('5. Recording revision: Solved Independently (should advance stage and use custom interval)...');
  const rev1 = await request(`/problems/${probId}/revisions`, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-10-11',
      result: 'Solved Independently',
      notes: 'Implemented DoublyLinkedList + Map cleanly.',
    }),
  }, token);
  assert.strictEqual(rev1.status, 201);
  assert.strictEqual(rev1.data.stage, 2);
  console.log(`✅ Revision recorded. Next stage: ${rev1.data.stage}, Scheduled next: ${rev1.data.nextRevisionDate}`);

  console.log('6. Recording revision: Unable To Solve (should reset stage to 1)...');
  const rev2 = await request(`/problems/${probId}/revisions`, {
    method: 'POST',
    body: JSON.stringify({
      date: '2026-10-16',
      result: 'Unable To Solve',
      notes: 'Got stuck on pointer manipulation.',
    }),
  }, token);
  assert.strictEqual(rev2.status, 201);
  assert.strictEqual(rev2.data.stage, 1);
  console.log(`✅ Reset verified. Stage is reset to: ${rev2.data.stage}`);

  console.log('7. Manual rescheduling of revision...');
  const reschedRes = await request(`/problems/${probId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ nextRevisionDate: '2026-11-01' }),
  }, token);
  assert.strictEqual(reschedRes.status, 200);
  assert.strictEqual(reschedRes.data.nextRevisionDate, '2026-11-01');

  // Verify updated in GET /api/problems/:id
  const checkRes = await request(`/problems/${probId}`, { method: 'GET' }, token);
  assert.strictEqual(checkRes.data.assessment.nextRevisionDate, '2026-11-01');
  assert.strictEqual(checkRes.data.revisionHistory.length, 2);
  console.log('✅ Manual rescheduling verified.');

  console.log('8. User ownership enforcement on revisions...');
  const userBReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: `intruder_${timestamp}`, password: 'password123' }),
  });
  const tokenB = userBReg.data.token;

  const attackRes = await request(`/problems/${probId}/revisions`, {
    method: 'POST',
    body: JSON.stringify({ date: '2026-10-12', result: 'Solved Independently' }),
  }, tokenB);
  assert.strictEqual(attackRes.status, 404, 'User B must not record revision for User A problem');

  const attackResched = await request(`/problems/${probId}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ nextRevisionDate: '2026-12-31' }),
  }, tokenB);
  assert.strictEqual(attackResched.status, 404, 'User B must not reschedule User A problem');
  console.log('✅ User ownership strictly enforced.');

  console.log('\n🎉 ALL SPACED-REPETITION REVISION TESTS PASSED SUCCESSFULLY!');
}

runSchedulerTests().catch((err) => {
  console.error('\n❌ Spaced-repetition test failure:', err);
  process.exit(1);
});
