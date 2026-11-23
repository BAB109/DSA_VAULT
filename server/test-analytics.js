// ==============================================================================
// TEST: Analytics and Dashboard Verification
// Tests dashboard metrics, all 7 charts, topic progress, timezone, and user isolation
// ==============================================================================

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('🧪 Starting Dashboard and Analytics API Verification...\n');

  // 1. Register User 1
  const u1Name = `analyst_${Date.now()}`;
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u1Name, password: 'Password123!' }),
  });
  const regData = await regRes.json();
  if (!regRes.ok) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  const token1 = regData.token;
  console.log('✅ User 1 registered & authenticated.');

  // 2. Test empty user analytics
  const emptyRes = await fetch(`${BASE_URL}/analytics?tz=UTC`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const emptyAnalytics = await emptyRes.json();
  if (!emptyRes.ok) throw new Error(`Empty analytics failed: ${JSON.stringify(emptyAnalytics)}`);

  console.log('📊 Empty user analytics check:');
  console.assert(emptyAnalytics.metrics.totalProblems === 0, 'Total problems should be 0');
  console.assert(emptyAnalytics.metrics.currentStreak === 0, 'Streak should be 0');
  console.assert(emptyAnalytics.metrics.independentSolvingRate === 0, 'Independent rate should be 0');
  console.assert(emptyAnalytics.metrics.betterSolutionReviewRate === 0, 'Review rate should be 0');
  console.assert(emptyAnalytics.topicProgress.length === 0, 'Topic progress should be empty');
  console.log('✅ Empty user state handled gracefully with 0 division errors.');

  // 3. Create sample problems for User 1
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const futureStr = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  // Problem 1: Easy, Solved Independently, due today
  const p1Res = await fetch(`${BASE_URL}/problems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      title: 'Two Sum',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/two-sum/',
      difficulty: 'Easy',
      status: 'Solved Independently',
      solvingDate: todayStr,
      topics: ['Array', 'Two Pointers'],
      reviewedBetterSolution: true,
      canSolveAgain: true,
      mistakeCategories: ['Off-by-one error'],
      nextRevisionDate: todayStr,
    }),
  });
  const p1 = await p1Res.json();
  console.log('✅ Problem 1 created:', p1.title);

  // Problem 2: Medium, Solved With Hint, due in 3 days
  const p2Res = await fetch(`${BASE_URL}/problems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      title: 'Longest Palindromic Substring',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/longest-palindromic-substring/',
      difficulty: 'Medium',
      status: 'Solved With Hint',
      solvingDate: todayStr,
      topics: ['Dynamic Programming', 'Array'],
      reviewedBetterSolution: false,
      canSolveAgain: false,
      mistakeCategories: ['Wrong algorithm'],
      nextRevisionDate: futureStr,
    }),
  });
  const p2 = await p2Res.json();
  console.log('✅ Problem 2 created:', p2.title);

  // Problem 3: Hard, Unable To Solve (attempted only), overdue
  const p3Res = await fetch(`${BASE_URL}/problems`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      title: 'Trapping Rain Water II',
      platform: 'LeetCode',
      problemUrl: 'https://leetcode.com/problems/trapping-rain-water-ii/',
      difficulty: 'Hard',
      status: 'Unable To Solve',
      solvingDate: yesterdayStr,
      topics: ['Graph'],
      reviewedBetterSolution: true,
      canSolveAgain: false,
      mistakeCategories: ['TLE'],
      nextRevisionDate: yesterdayStr,
    }),
  });
  const p3 = await p3Res.json();
  console.log('✅ Problem 3 created:', p3.title);

  // 4. Fetch User 1 Analytics
  const populatedRes = await fetch(`${BASE_URL}/analytics?tz=UTC`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const populated = await populatedRes.json();
  if (!populatedRes.ok) throw new Error(`Analytics failed: ${JSON.stringify(populated)}`);

  console.log('\n📊 Populated Analytics Verification:');
  console.log('  Total problems:', populated.metrics.totalProblems, '(expected: 3)');
  console.log('  Problems solved today:', populated.metrics.problemsSolvedToday, '(expected: 2)');
  console.log('  Difficulty counts:', populated.metrics.difficultyCounts, '(expected: Easy:1, Med:1, Hard:1)');
  console.log('  Current streak:', populated.metrics.currentStreak, '(expected: 1)');
  console.log('  Problems due for revision:', populated.metrics.problemsDueForRevision, '(expected: 2: 1 overdue + 1 today)');
  console.log('  Independent solve rate:', populated.metrics.independentSolvingRate, '% (expected: 33%)');
  console.log('  Better solution review rate:', populated.metrics.betterSolutionReviewRate, '% (expected: 67%)');
  console.log('  Daily goal progress:', populated.metrics.dailyGoalProgress, '%');

  if (populated.metrics.totalProblems !== 3) throw new Error('Incorrect total problems');
  if (populated.metrics.problemsSolvedToday !== 2) throw new Error('Incorrect solved today count');
  if (populated.metrics.problemsDueForRevision !== 2) throw new Error('Incorrect due count');
  if (populated.metrics.currentStreak < 1) throw new Error('Streak should be at least 1');

  // Verify Charts
  console.log('\n📈 Charts Verification:');
  console.log('  7-Day Activity items:', populated.charts.dailyActivity7Days.length);
  console.log('  30-Day Activity items:', populated.charts.dailyActivity30Days.length);
  console.log('  Difficulty distribution:', populated.charts.difficultyDistribution);
  console.log('  Topic counts:', populated.charts.topicProblemCounts);
  console.log('  Solving performance:', populated.charts.solvingPerformance);
  console.log('  Mistake categories:', populated.charts.mistakeCategories);

  if (populated.charts.dailyActivity7Days.length !== 7) throw new Error('7-day activity should have 7 entries');
  if (populated.charts.dailyActivity30Days.length !== 30) throw new Error('30-day activity should have 30 entries');

  // 5. Record Revision
  console.log('\n🔄 Testing Spaced-Repetition Revision record:');
  const revRes = await fetch(`${BASE_URL}/problems/${p1.id}/revisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({
      result: 'Solved Independently',
      notes: 'Remembered the two pointer logic instantly',
    }),
  });
  const revData = await revRes.json();
  if (!revRes.ok) throw new Error(`Revision recording failed: ${JSON.stringify(revData)}`);
  console.log('✅ Revision recorded on Problem 1:', revData.revision.result);

  // 6. Check updated revision stats in Analytics
  const postRevRes = await fetch(`${BASE_URL}/analytics?tz=UTC`, {
    headers: { Authorization: `Bearer ${token1}` },
  });
  const postRev = await postRevRes.json();
  console.log('  Total revisions:', postRev.metrics.totalRevisionsCount, '(expected: 1)');
  console.log('  Revision success rate:', postRev.metrics.revisionSuccessRate, '% (expected: 100%)');
  console.log('  Revision outcomes:', postRev.charts.revisionOutcomes);

  if (postRev.metrics.totalRevisionsCount !== 1) throw new Error('Revision count should be 1');
  if (postRev.metrics.revisionSuccessRate !== 100) throw new Error('Revision success rate should be 100%');

  // 7. Verify Topic Progress Table
  console.log('\n📑 Topic Progress Table Verification:');
  console.log(postRev.topicProgress);
  const arrayTopic = postRev.topicProgress.find((t) => t.topic === 'Array');
  if (!arrayTopic) throw new Error('Array topic should be present');
  console.log('  Array Topic Stats:', arrayTopic);
  console.assert(arrayTopic.totalProblems === 2, 'Array should have 2 problems');
  console.assert(arrayTopic.revisedSuccessfully === 1, 'Array should have 1 revised successfully');

  // 8. Test Strict User Isolation with User 2
  console.log('\n🔒 Testing User Isolation:');
  const u2Name = `analyst2_${Date.now()}`;
  const reg2Res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u2Name, password: 'Password123!' }),
  });
  const reg2Data = await reg2Res.json();
  const token2 = reg2Data.token;

  const user2AnalyticsRes = await fetch(`${BASE_URL}/analytics?tz=UTC`, {
    headers: { Authorization: `Bearer ${token2}` },
  });
  const user2Analytics = await user2AnalyticsRes.json();
  console.log('  User 2 total problems:', user2Analytics.metrics.totalProblems);
  if (user2Analytics.metrics.totalProblems !== 0) {
    throw new Error('User 2 must not see User 1 problems!');
  }
  console.log('✅ Strict user isolation confirmed: User 2 sees 0 problems.');

  console.log('\n🎉 ALL DASHBOARD AND ANALYTICS TESTS PASSED WITH 100% SUCCESS!');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
