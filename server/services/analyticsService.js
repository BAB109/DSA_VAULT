// ==============================================================================
// ANALYTICS SERVICE - DSA Vault
// Computes metrics, charts, topic progress, and streak calculations.
// Adheres strictly to timezone boundaries, user isolation, and zero-division guards.
// ==============================================================================

/**
 * Format date in specified IANA timezone as YYYY-MM-DD
 */
export function formatInTz(date, timeZone = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date instanceof Date ? date : new Date(date));
  } catch {
    // Fallback to UTC if timezone is invalid
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
  }
}

/**
 * Get weekday or short date label in specified timezone
 */
export function formatDayLabel(date, timeZone = 'UTC', style = 'weekday') {
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (style === 'weekday') {
      return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(d);
    }
    return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(d);
  } catch {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString();
  }
}

/**
 * Standardize revision outcomes (including legacy values)
 */
export function normalizeRevisionOutcome(result) {
  if (!result) return null;
  if (result === 'Remembered' || result === 'Solved Independently') return 'Solved Independently';
  if (result === 'Partially Remembered' || result === 'Solved With Hint') return 'Solved With Hint';
  if (result === 'Reviewed The Solution') return 'Reviewed The Solution';
  if (result === 'Forgot' || result === 'Unable To Solve') return 'Unable To Solve';
  return result;
}

/**
 * Check if a problem is considered solved independently
 */
export function isIndependentlySolved(p) {
  if (p.can_solve_independently === false || p.assessment?.canSolveAgain === false) return false;
  if (p.can_solve_independently === true || p.assessment?.canSolveAgain === true) return true;
  const status = p.solving_status || p.status;
  return status === 'Solved Independently';
}

/**
 * Check if a problem is considered solved (excluding 'Unable To Solve')
 */
export function isSolvedProblem(p) {
  const status = p.solving_status || p.status;
  return status !== 'Unable To Solve' && status !== 'Unsolved';
}

/**
 * Compute the user's active solving streak
 * Activity definition:
 * A day earns streak credit if the user either:
 *  1. Solved at least 1 problem (solving_status != 'Unable To Solve'), OR
 *  2. Completed at least 1 revision attempt.
 * Evaluated strictly in the user's configured timezone.
 */
export function calculateStreak(problems = [], revisions = [], timeZone = 'UTC') {
  const activeDates = new Set();

  // Add problem solve dates
  for (const p of problems) {
    if (isSolvedProblem(p)) {
      const rawDate = p.solved_at || p.solvingDate;
      if (rawDate) {
        // If it's a date or timestamp, format into YYYY-MM-DD
        const dateStr = typeof rawDate === 'string' && rawDate.length === 10
          ? rawDate
          : formatInTz(rawDate, timeZone);
        activeDates.add(dateStr);
      }
    }
  }

  // Add revision completed dates
  for (const r of revisions) {
    const comp = r.completed_at || r.completedAt || r.date;
    if (comp) {
      const dateStr = formatInTz(comp, timeZone);
      activeDates.add(dateStr);
    }
  }

  const now = new Date();
  const todayStr = formatInTz(now, timeZone);

  // Check yesterday
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = formatInTz(yesterdayDate, timeZone);

  let checkDate = now;
  let checkStr = todayStr;

  if (!activeDates.has(todayStr)) {
    // If not active today yet, check if active yesterday to keep streak alive
    if (activeDates.has(yesterdayStr)) {
      checkDate = yesterdayDate;
      checkStr = yesterdayStr;
    } else {
      return 0; // Streak broken
    }
  }

  let streak = 0;
  // Traverse backward calendar days
  while (activeDates.has(checkStr)) {
    streak++;
    checkDate = new Date(checkDate.getTime() - 86400000);
    checkStr = formatInTz(checkDate, timeZone);
  }

  return streak;
}

/**
 * Build daily activity windows (7 days and 30 days)
 */
export function buildDailyActivity(problems = [], revisions = [], daysCount = 7, timeZone = 'UTC') {
  const now = new Date();
  const result = [];

  for (let i = daysCount - 1; i >= 0; i--) {
    const targetDate = new Date(now.getTime() - i * 86400000);
    const dateStr = formatInTz(targetDate, timeZone);
    const dayLabel = formatDayLabel(targetDate, timeZone, daysCount <= 7 ? 'weekday' : 'monthDay');

    const problemsSolved = problems.filter((p) => {
      if (!isSolvedProblem(p)) return false;
      const rawDate = p.solved_at || p.solvingDate;
      const dStr = typeof rawDate === 'string' && rawDate.length === 10 ? rawDate : formatInTz(rawDate, timeZone);
      return dStr === dateStr;
    }).length;

    const revisionsCompleted = revisions.filter((r) => {
      const comp = r.completed_at || r.completedAt || r.date;
      return comp && formatInTz(comp, timeZone) === dateStr;
    }).length;

    result.push({
      date: dateStr,
      day: dayLabel,
      problemsSolved,
      revisionsCompleted,
      totalActivity: problemsSolved + revisionsCompleted,
    });
  }

  return result;
}

/**
 * Build 52-week (364-day) GitHub-style annual activity calendar
 * Grouped into weeks (Sunday through Saturday) ending on current week.
 */
export function buildAnnualActivityCalendar(problems = [], revisions = [], timeZone = 'UTC') {
  const problemsByDate = new Map();
  const revisionsByDate = new Map();

  for (const p of problems) {
    if (isSolvedProblem(p)) {
      const rawDate = p.solved_at || p.solvingDate;
      if (rawDate) {
        const dStr = typeof rawDate === 'string' && rawDate.length === 10 ? rawDate : formatInTz(rawDate, timeZone);
        problemsByDate.set(dStr, (problemsByDate.get(dStr) || 0) + 1);
      }
    }
  }

  for (const r of revisions) {
    const comp = r.completed_at || r.completedAt || r.date;
    if (comp) {
      const dStr = formatInTz(comp, timeZone);
      revisionsByDate.set(dStr, (revisionsByDate.get(dStr) || 0) + 1);
    }
  }

  const now = new Date();
  const todayStr = formatInTz(now, timeZone);
  const todayDate = new Date(todayStr + 'T12:00:00Z');
  const todayDayOfWeek = todayDate.getUTCDay(); // 0 = Sun, 6 = Sat

  // Align to end on the upcoming or current Saturday
  const daysToSaturday = 6 - todayDayOfWeek;
  const endOfWeekDate = new Date(todayDate.getTime() + daysToSaturday * 86400000);

  // 52 full weeks = 52 * 7 = 364 days. Sunday 52 weeks ago is 363 days before end Saturday.
  const startDate = new Date(endOfWeekDate.getTime() - 363 * 86400000);

  const days = [];
  const weeks = [];
  let currentWeek = [];
  const monthLabels = [];
  let lastLabeledMonth = '';

  for (let i = 0; i < 364; i++) {
    const cellDate = new Date(startDate.getTime() + i * 86400000);
    const dateStr = cellDate.toISOString().split('T')[0];
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    const problemsCount = isFuture ? 0 : (problemsByDate.get(dateStr) || 0);
    const revisionsCount = isFuture ? 0 : (revisionsByDate.get(dateStr) || 0);
    const totalActivity = problemsCount + revisionsCount;

    let level = 0;
    if (!isFuture && totalActivity > 0) {
      if (totalActivity <= 2) level = 1;
      else if (totalActivity <= 4) level = 2;
      else if (totalActivity <= 6) level = 3;
      else level = 4;
    }

    const monthName = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(cellDate);
    const dayOfWeek = cellDate.getUTCDay();
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(cellDate);

    const dayObj = {
      date: dateStr,
      count: totalActivity,
      problemsCount,
      revisionsCount,
      level,
      isToday,
      isFuture,
      dayOfWeek,
      month: monthName,
      formattedDate,
    };

    days.push(dayObj);
    currentWeek.push(dayObj);

    if (dayOfWeek === 6) {
      // Completed a week
      const weekIndex = weeks.length;
      // Check if this week starts a new month
      const firstDayOfMonth = currentWeek.find((d) => d.date.endsWith('-01')) || (dayOfWeek === 0 && currentWeek[0].month !== lastLabeledMonth ? currentWeek[0] : null);
      const weekMonth = currentWeek[0].month;
      if (weekMonth !== lastLabeledMonth && weekIndex < 50) {
        monthLabels.push({ label: weekMonth, weekIndex });
        lastLabeledMonth = weekMonth;
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Calculate annual summary statistics
  let totalActivitiesYear = 0;
  let activeDaysCount = 0;
  let longestStreak = 0;
  let currentStreakRun = 0;

  for (const d of days) {
    if (d.isFuture) continue;
    totalActivitiesYear += d.count;
    if (d.count > 0) {
      activeDaysCount++;
      currentStreakRun++;
      if (currentStreakRun > longestStreak) {
        longestStreak = currentStreakRun;
      }
    } else {
      currentStreakRun = 0;
    }
  }

  return {
    days,
    weeks,
    months: monthLabels,
    totalActivitiesYear,
    activeDaysCount,
    longestStreak,
  };
}

/**
 * Main analytics calculator
 */
export function computeUserAnalytics({
  problems = [],
  revisions = [],
  userSettings = {},
  timeZone = 'UTC',
}) {
  const totalProblems = problems.length;
  const now = new Date();
  const todayStr = formatInTz(now, timeZone);
  const weekAheadStr = formatInTz(new Date(now.getTime() + 7 * 86400000), timeZone);

  // Daily goals settings
  const dailyProblemGoal = userSettings.dailyProblemGoal || userSettings.daily_problem_goal || userSettings.dailyGoal || 3;
  const dailyRevisionGoal = userSettings.dailyRevisionGoal || userSettings.daily_revision_goal || 2;
  const weeklyGoal = userSettings.weeklyGoal || userSettings.weekly_problem_goal || 15;

  // Streak
  const currentStreak = calculateStreak(problems, revisions, timeZone);

  // Problems solved today
  const problemsSolvedToday = problems.filter((p) => {
    if (!isSolvedProblem(p)) return false;
    const rawDate = p.solved_at || p.solvingDate;
    const dStr = typeof rawDate === 'string' && rawDate.length === 10 ? rawDate : formatInTz(rawDate, timeZone);
    return dStr === todayStr;
  }).length;

  // Revisions completed today
  const revisionsCompletedToday = revisions.filter((r) => {
    const comp = r.completed_at || r.completedAt || r.date;
    return comp && formatInTz(comp, timeZone) === todayStr;
  }).length;

  // Solved this week (last 7 days)
  const last7DaysData = buildDailyActivity(problems, revisions, 7, timeZone);
  const solvedThisWeek = last7DaysData.reduce((acc, curr) => acc + curr.problemsSolved, 0);

  // Goal progress
  const dailyGoal = dailyProblemGoal; // backward-compat alias
  const dailyGoalProgress = Math.min(100, Math.round((problemsSolvedToday / Math.max(1, dailyProblemGoal)) * 100));
  const dailyProblemGoalProgress = dailyGoalProgress;
  const dailyRevisionGoalProgress = Math.min(100, Math.round((revisionsCompletedToday / Math.max(1, dailyRevisionGoal)) * 100));
  const weeklyGoalProgress = Math.min(100, Math.round((solvedThisWeek / Math.max(1, weeklyGoal)) * 100));
  const allDailyGoalsMet = problemsSolvedToday >= dailyProblemGoal && revisionsCompletedToday >= dailyRevisionGoal;

  // Annual Activity Calendar
  const calendar = buildAnnualActivityCalendar(problems, revisions, timeZone);

  // Difficulty counts
  const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
  problems.forEach((p) => {
    const diff = p.difficulty;
    if (difficultyCounts[diff] !== undefined) {
      difficultyCounts[diff]++;
    }
  });

  const difficultyDistribution = ['Easy', 'Medium', 'Hard'].map((diff) => ({
    name: diff,
    count: difficultyCounts[diff],
    percentage: totalProblems > 0 ? Math.round((difficultyCounts[diff] / totalProblems) * 100) : 0,
  }));

  // Revisions due status
  let dueTodayCount = 0;
  let overdueCount = 0;
  let dueThisWeekCount = 0;

  problems.forEach((p) => {
    const nextRev = p.next_revision_at ? (typeof p.next_revision_at === 'string' ? p.next_revision_at.split('T')[0] : p.next_revision_at.toISOString().split('T')[0]) : p.assessment?.nextRevisionDate;
    if (!nextRev) return;

    if (nextRev < todayStr) {
      overdueCount++;
    } else if (nextRev === todayStr) {
      dueTodayCount++;
    }

    if (nextRev >= todayStr && nextRev <= weekAheadStr) {
      dueThisWeekCount++;
    }
  });

  const problemsDueForRevision = overdueCount + dueTodayCount;

  // Rates
  const independentlySolvedCount = problems.filter(isIndependentlySolved).length;
  const independentSolvingRate = totalProblems > 0
    ? Math.round((independentlySolvedCount / totalProblems) * 100)
    : 0;

  const reviewedBetterSolutionCount = problems.filter((p) =>
    p.reviewed_better_solution === true || p.improvedSolution?.reviewed === true
  ).length;
  const betterSolutionReviewRate = totalProblems > 0
    ? Math.round((reviewedBetterSolutionCount / totalProblems) * 100)
    : 0;

  // Independent Solving Performance breakdown (attempted, solved with hint/help, independent)
  const solvingPerformance = {
    totalAttempted: problems.filter((p) => !isSolvedProblem(p)).length,
    totalSolvedWithHelp: problems.filter((p) => (p.solving_status === 'Solved With Help' || p.status === 'Solved With Help')).length,
    totalSolvedWithHint: problems.filter((p) => (p.solving_status === 'Solved With Hint' || p.status === 'Solved With Hint')).length,
    totalSolvedIndependently: independentlySolvedCount,
    overallRate: independentSolvingRate,
    byDifficulty: ['Easy', 'Medium', 'Hard'].map((diff) => {
      const diffProbs = problems.filter((p) => p.difficulty === diff);
      const diffTotal = diffProbs.length;
      const diffInd = diffProbs.filter(isIndependentlySolved).length;
      return {
        difficulty: diff,
        total: diffTotal,
        independent: diffInd,
        rate: diffTotal > 0 ? Math.round((diffInd / diffTotal) * 100) : 0,
      };
    }),
  };

  // Revision outcomes breakdown
  const revisionOutcomesMap = {
    'Solved Independently': 0,
    'Solved With Hint': 0,
    'Reviewed The Solution': 0,
    'Unable To Solve': 0,
  };

  revisions.forEach((r) => {
    const norm = normalizeRevisionOutcome(r.result);
    if (norm && revisionOutcomesMap[norm] !== undefined) {
      revisionOutcomesMap[norm]++;
    }
  });

  const totalRevisionsCount = revisions.length;
  const successfulRevisionsCount = revisionOutcomesMap['Solved Independently'];
  const revisionSuccessRate = totalRevisionsCount > 0
    ? Math.round((successfulRevisionsCount / totalRevisionsCount) * 100)
    : 0;

  const revisionOutcomes = Object.entries(revisionOutcomesMap).map(([outcome, count]) => ({
    outcome,
    count,
    percentage: totalRevisionsCount > 0 ? Math.round((count / totalRevisionsCount) * 100) : 0,
  }));

  // Topic metrics & progress
  const topicStatsMap = new Map();

  problems.forEach((p) => {
    const pTopics = p.topics || (Array.isArray(p.topic_list) ? p.topic_list : []);
    const isInd = isIndependentlySolved(p);
    const nextRev = p.next_revision_at ? (typeof p.next_revision_at === 'string' ? p.next_revision_at.split('T')[0] : p.next_revision_at.toISOString().split('T')[0]) : p.assessment?.nextRevisionDate;
    const isDue = Boolean(nextRev && nextRev <= todayStr);

    // Check if this problem had a successful revision
    const pRevs = p.revisions || p.revisionHistory || [];
    const hasSuccessfulRev = pRevs.some((r) => normalizeRevisionOutcome(r.result) === 'Solved Independently');

    pTopics.forEach((t) => {
      if (!topicStatsMap.has(t)) {
        topicStatsMap.set(t, {
          topic: t,
          totalProblems: 0,
          solvedIndependently: 0,
          revisedSuccessfully: 0,
          dueForRevision: 0,
        });
      }
      const stat = topicStatsMap.get(t);
      stat.totalProblems++;
      if (isInd) stat.solvedIndependently++;
      if (hasSuccessfulRev) stat.revisedSuccessfully++;
      if (isDue) stat.dueForRevision++;
    });
  });

  const topicProgress = Array.from(topicStatsMap.values())
    .map((stat) => ({
      ...stat,
      independentRate: stat.totalProblems > 0 ? Math.round((stat.solvedIndependently / stat.totalProblems) * 100) : 0,
    }))
    .sort((a, b) => b.totalProblems - a.totalProblems);

  const topicProblemCounts = topicProgress.map((t) => ({
    topic: t.topic,
    count: t.totalProblems,
  }));

  // Mistake categories frequency
  const mistakeCountsMap = {};
  problems.forEach((p) => {
    const mistakes = p.mistakes || p.assessment?.mistakeCategories || (Array.isArray(p.mistake_list) ? p.mistake_list : []);
    mistakes.forEach((m) => {
      mistakeCountsMap[m] = (mistakeCountsMap[m] || 0) + 1;
    });
  });

  const mistakeCategories = Object.entries(mistakeCountsMap)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalProblems > 0 ? Math.round((count / totalProblems) * 100) : 0,
    }));

  // 30 days activity
  const last30DaysData = buildDailyActivity(problems, revisions, 30, timeZone);

  return {
    metrics: {
      totalProblems,
      problemsSolvedToday,
      revisionsCompletedToday,
      solvedThisWeek,
      difficultyCounts,
      currentStreak,
      problemsDueForRevision,
      dueTodayCount,
      overdueCount,
      dueThisWeekCount,
      independentSolvingRate,
      betterSolutionReviewRate,
      dailyGoal,
      dailyProblemGoal,
      dailyRevisionGoal,
      dailyGoalProgress,
      dailyProblemGoalProgress,
      dailyRevisionGoalProgress,
      allDailyGoalsMet,
      weeklyGoal,
      weeklyGoalProgress,
      totalRevisionsCount,
      revisionSuccessRate,
      timezone: timeZone,
    },
    charts: {
      dailyActivity7Days: last7DaysData,
      dailyActivity30Days: last30DaysData,
      difficultyDistribution,
      topicProblemCounts,
      solvingPerformance,
      revisionOutcomes,
      mistakeCategories,
    },
    calendar,
    topicProgress,
  };
}
