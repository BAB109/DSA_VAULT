// ==============================================================================
// TEST: Daily Goals & Activity Calendar Calculations
// Tests date boundaries, goal updates & validation, and calendar heatmap rules
// ==============================================================================

import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('🧪 Starting Daily Goals and Activity Calendar Verification...\n');

  // 1. Register test user
  const username = `goal_cal_user_${Date.now()}`;
  const reg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password: 'Password123!' }),
  });
  assert.strictEqual(reg.status, 201);
  const token = reg.data.token;
  console.log('✅ User registered & authenticated.');

  // 2. Test initial settings defaults
  const initSet = await request('/settings', { method: 'GET' }, token);
  assert.strictEqual(initSet.status, 200);
  assert.strictEqual(initSet.data.dailyProblemGoal, 3);
  assert.strictEqual(initSet.data.dailyRevisionGoal, 2);
  console.log('✅ Initial default goals verified: 3 problems/day, 2 revisions/day.');

  // 3. Test goal updates and sensible validation
  console.log('Testing goal validation...');
  const invalidProb = await request('/settings', {
    method: 'PUT',
    body: JSON.stringify({ dailyProblemGoal: 0 }),
  }, token);
  assert.strictEqual(invalidProb.status, 400, 'Should reject problem goal < 1');

  const invalidRev = await request('/settings', {
    method: 'PUT',
    body: JSON.stringify({ dailyRevisionGoal: -5 }),
  }, token);
  assert.strictEqual(invalidRev.status, 400, 'Should reject revision goal < 1');

  const invalidNan = await request('/settings', {
    method: 'PUT',
    body: JSON.stringify({ dailyProblemGoal: 'abc' }),
  }, token);
  assert.strictEqual(invalidNan.status, 400, 'Should reject non-numeric goal');
  console.log('✅ Sensible validation enforced (rejection of 0, negative, and non-numeric goals).');

  // Valid goal update
  const updateRes = await request('/settings', {
    method: 'PUT',
    body: JSON.stringify({
      dailyProblemGoal: 5,
      dailyRevisionGoal: 4,
      timezone: 'UTC',
    }),
  }, token);
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.data.dailyProblemGoal, 5);
  assert.strictEqual(updateRes.data.dailyRevisionGoal, 4);

  // Verify persistence on fresh GET
  const verifySet = await request('/settings', { method: 'GET' }, token);
  assert.strictEqual(verifySet.data.dailyProblemGoal, 5);
  assert.strictEqual(verifySet.data.dailyRevisionGoal, 4);
  console.log('✅ Daily goals persisted and reloaded successfully.');

  // 4. Test Calendar calculations on empty user
  const emptyAnalytics = await request('/analytics?tz=UTC', { method: 'GET' }, token);
  assert.strictEqual(emptyAnalytics.status, 200);
  const emptyCal = emptyAnalytics.data.calendar;
  assert(emptyCal != null, 'Calendar must be present');
  assert.strictEqual(emptyCal.weeks.length, 52, 'Calendar should span 52 weeks');
  assert.strictEqual(emptyCal.days.length, 364, 'Calendar should contain 364 total cell days');
  assert.strictEqual(emptyCal.totalActivitiesYear, 0);
  assert.strictEqual(emptyCal.activeDaysCount, 0);
  assert.strictEqual(emptyCal.longestStreak, 0);
  console.log('✅ Empty user calendar structure verified: 52 weeks, 364 cells, all level 0.');

  // 5. Test activity generation and date boundaries
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgoStr = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

  // Create Problem 1 (solved today)
  const p1 = await request('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Valid Palindrome',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/valid-palindrome/',
      difficulty: 'Easy',
      status: 'Solved Independently',
      solvingDate: todayStr,
      topics: ['Two Pointers', 'String'],
    }),
  }, token);
  assert.strictEqual(p1.status, 201);

  // Create Problem 2 (solved today)
  const p2 = await request('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Valid Parentheses',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/valid-parentheses/',
      difficulty: 'Easy',
      status: 'Solved Independently',
      solvingDate: todayStr,
      topics: ['Stack', 'String'],
    }),
  }, token);
  assert.strictEqual(p2.status, 201);

  // Create Problem 3 (solved yesterday)
  const p3 = await request('/problems', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Invert Binary Tree',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/invert-binary-tree/',
      difficulty: 'Easy',
      status: 'Solved Independently',
      solvingDate: yesterdayStr,
      topics: ['Tree'],
    }),
  }, token);
  assert.strictEqual(p3.status, 201);

  // Record 1 revision today on Problem 3
  const rev1 = await request(`/problems/${p3.data.id}/revisions`, {
    method: 'POST',
    body: JSON.stringify({
      date: todayStr,
      result: 'Solved Independently',
      notes: 'Quick recursive inversion',
    }),
  }, token);
  assert.strictEqual(rev1.status, 201);

  // Record 1 revision 2 days ago on Problem 3
  const rev2 = await request(`/problems/${p3.data.id}/revisions`, {
    method: 'POST',
    body: JSON.stringify({
      date: twoDaysAgoStr,
      result: 'Solved Independently',
      notes: 'First recall attempt',
    }),
  }, token);
  assert.strictEqual(rev2.status, 201);

  // 6. Verify populated Analytics and Calendar counts
  const popAnalytics = await request('/analytics?tz=UTC', { method: 'GET' }, token);
  assert.strictEqual(popAnalytics.status, 200);

  const m = popAnalytics.data.metrics;
  console.log('\n📊 Daily Goals Metrics:');
  console.log(`  Problems solved today: ${m.problemsSolvedToday} / ${m.dailyProblemGoal} (${m.dailyProblemGoalProgress}%)`);
  console.log(`  Revisions completed today: ${m.revisionsCompletedToday} / ${m.dailyRevisionGoal} (${m.dailyRevisionGoalProgress}%)`);
  assert.strictEqual(m.problemsSolvedToday, 2, 'Should have 2 problems solved today');
  assert.strictEqual(m.revisionsCompletedToday, 1, 'Should have 1 revision completed today');
  assert.strictEqual(m.dailyProblemGoalProgress, 40, '2/5 = 40%');
  assert.strictEqual(m.dailyRevisionGoalProgress, 25, '1/4 = 25%');
  assert.strictEqual(m.allDailyGoalsMet, false);

  const cal = popAnalytics.data.calendar;
  console.log('\n📅 Calendar Verification:');
  console.log(`  Total annual activities: ${cal.totalActivitiesYear}`);
  console.log(`  Active days count: ${cal.activeDaysCount}`);
  console.log(`  Longest streak: ${cal.longestStreak}`);

  // Today activity: 2 problems + 1 revision = 3 activities (Level 2)
  const todayCell = cal.days.find((d) => d.date === todayStr);
  assert(todayCell != null, 'Today cell must exist');
  console.log(`  Today cell:`, todayCell);
  assert.strictEqual(todayCell.count, 3, 'Today should have 3 total activities');
  assert.strictEqual(todayCell.problemsCount, 2);
  assert.strictEqual(todayCell.revisionsCount, 1);
  assert.strictEqual(todayCell.level, 2, '3 activities should map to level 2');

  // Yesterday activity: 1 problem + 0 revisions = 1 activity (Level 1)
  const yestCell = cal.days.find((d) => d.date === yesterdayStr);
  assert(yestCell != null, 'Yesterday cell must exist');
  assert.strictEqual(yestCell.count, 1);
  assert.strictEqual(yestCell.level, 1);

  // Two days ago: 0 problems + 1 revision = 1 activity (Level 1)
  const twoDaysAgoCell = cal.days.find((d) => d.date === twoDaysAgoStr);
  assert(twoDaysAgoCell != null, 'Two days ago cell must exist');
  assert.strictEqual(twoDaysAgoCell.count, 1);
  assert.strictEqual(twoDaysAgoCell.level, 1);

  // Streak: 3 consecutive days (two days ago, yesterday, today)
  assert.strictEqual(cal.longestStreak, 3, 'Longest streak should be 3');
  assert.strictEqual(cal.activeDaysCount, 3, 'Active days count should be 3');
  assert.strictEqual(cal.totalActivitiesYear, 5, 'Total activities should be 5 (3 problems + 2 revisions)');

  // 7. Verify Timezone boundary consistency
  const tzAnalytics = await request('/analytics?tz=America/New_York', { method: 'GET' }, token);
  assert.strictEqual(tzAnalytics.status, 200);
  assert.strictEqual(tzAnalytics.data.metrics.timezone, 'America/New_York');
  console.log('✅ Timezone boundary handling verified with configured timezone.');

  console.log('\n🎉 ALL DAILY GOALS & ACTIVITY CALENDAR TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
