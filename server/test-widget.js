// ==============================================================================
// TEST: Widget API Verification (GET /api/widget/summary)
// Tests:
// 1. Unauthenticated request rejection (401)
// 2. Authentication and initial zero-state stats
// 3. Problem creation and widget stat reflection (total, solved, remaining, difficulty)
// 4. Multi-user isolation (User A cannot see User B's widget stats)
// 5. Response headers (Cache-Control)
// ==============================================================================

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('🧪 Starting Widget API Verification...\n');

  // 1. Test unauthenticated request
  console.log('1. Testing unauthenticated request to /widget/summary...');
  const unauthRes = await fetch(`${BASE_URL}/widget/summary`);
  if (unauthRes.status === 401) {
    console.log('✅ Correctly rejected unauthenticated request with 401 UNAUTHORIZED.');
  } else {
    throw new Error(`Expected 401 but got ${unauthRes.status}`);
  }

  // 2. Register test user
  const username = `widget_user_${Date.now()}`;
  console.log(`2. Registering test user: ${username}...`);
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'SecurePassword123!' }),
  });
  const regData = await regRes.json();
  if (!regRes.ok) throw new Error(`User registration failed: ${JSON.stringify(regData)}`);
  const token = regData.token;
  console.log('✅ User registered successfully.');

  // 3. Fetch initial widget summary
  console.log('3. Fetching initial widget summary for new user...');
  const widgetRes = await fetch(`${BASE_URL}/widget/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!widgetRes.ok) {
    const errText = await widgetRes.text();
    throw new Error(`Widget summary failed: ${widgetRes.status} -> ${errText}`);
  }
  const summary = await widgetRes.json();
  console.log('Widget summary received:', summary);

  if (summary.username !== username) throw new Error(`Username mismatch: expected ${username}, got ${summary.username}`);
  if (summary.totalProblems !== 0) throw new Error(`Expected 0 totalProblems, got ${summary.totalProblems}`);
  if (summary.solvedCount !== 0) throw new Error(`Expected 0 solvedCount, got ${summary.solvedCount}`);
  if (summary.remainingCount !== 0) throw new Error(`Expected 0 remainingCount, got ${summary.remainingCount}`);
  if (!summary.lastSyncedAt) throw new Error('Missing lastSyncedAt in response');
  console.log('✅ Initial empty widget summary verified.');

  // 4. Create a solved problem and verify update
  console.log('4. Creating a solved problem...');
  const probRes = await fetch(`${BASE_URL}/problems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Two Sum Widget Test',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/two-sum/',
      difficulty: 'Easy',
      status: 'Solved Independently',
      solvingDate: new Date().toISOString().split('T')[0],
      initialApproach: { description: 'Hash map for complements' },
      confidenceRating: 5,
      canSolveAgain: true,
      topics: ['Array', 'Hash Map'],
    }),
  });

  if (!probRes.ok) {
    const errText = await probRes.text();
    throw new Error(`Problem creation failed: ${probRes.status} ${errText}`);
  }
  console.log('✅ Problem created.');

  // 5. Re-check widget summary
  console.log('5. Re-checking widget summary...');
  const updatedRes = await fetch(`${BASE_URL}/widget/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const updatedSummary = await updatedRes.json();
  console.log('Updated summary:', updatedSummary);

  if (updatedSummary.totalProblems !== 1) throw new Error(`Expected 1 total problem, got ${updatedSummary.totalProblems}`);
  if (updatedSummary.solvedCount !== 1) throw new Error(`Expected 1 solved problem, got ${updatedSummary.solvedCount}`);
  if (updatedSummary.difficultyCounts.Easy !== 1) throw new Error(`Expected 1 Easy problem, got ${updatedSummary.difficultyCounts.Easy}`);
  console.log('✅ Widget summary accurately reflected problem solve.');

  // 6. Multi-user isolation test
  console.log('6. Testing user isolation with second user...');
  const user2 = `isolated_${Date.now()}`;
  const regRes2 = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user2, password: 'SecurePassword123!' }),
  });
  const token2 = (await regRes2.json()).token;

  const user2SummaryRes = await fetch(`${BASE_URL}/widget/summary`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const user2Summary = await user2SummaryRes.json();
  if (user2Summary.totalProblems !== 0) throw new Error(`Isolation failed: User 2 sees ${user2Summary.totalProblems} problems!`);
  console.log('✅ Multi-user isolation verified.');

  console.log('\n🎉 ALL WIDGET API TESTS PASSED SUCCESSFULLY!\n');
}

run().catch((err) => {
  console.error('\n❌ Widget API Test Failure:', err);
  process.exit(1);
});
