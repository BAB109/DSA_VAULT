import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Flame, Clock, RotateCcw, Brain,
  TrendingUp, BookOpen, AlertCircle, Target, Sparkles,
  CheckCheck, ArrowRight, BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { format } from 'date-fns';
import { problemService } from '../services/problemService';
import { StatCard, Card, CardHeader, CardBody } from '../components/Card';
import { DifficultyBadge, StatusBadge } from '../components/Badges';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import ActivityCalendar from '../components/ActivityCalendar';

const DIFF_COLORS = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444',
};

const TOPIC_PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#84cc16'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [problems, setProblems] = useState([]);
  const [activityWindow, setActivityWindow] = useState('7d'); // '7d' or '30d'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, problemsRes] = await Promise.all([
        problemService.getAnalytics(),
        problemService.getAll({ limit: 5, sort: 'newest' }),
      ]);
      setData(analyticsRes);
      // problemsRes can be either an array or { data: [...] }
      setProblems(Array.isArray(problemsRes) ? problemsRes : (problemsRes.data || []));
    } catch (e) {
      setError(e.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState message="Loading live dashboard metrics..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const metrics = data?.metrics || {
    totalProblems: 0,
    problemsSolvedToday: 0,
    revisionsCompletedToday: 0,
    difficultyCounts: { Easy: 0, Medium: 0, Hard: 0 },
    currentStreak: 0,
    problemsDueForRevision: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    dueThisWeekCount: 0,
    independentSolvingRate: 0,
    betterSolutionReviewRate: 0,
    dailyGoal: 3,
    dailyProblemGoal: 3,
    dailyRevisionGoal: 2,
    dailyGoalProgress: 0,
    dailyProblemGoalProgress: 0,
    dailyRevisionGoalProgress: 0,
    allDailyGoalsMet: false,
    totalRevisionsCount: 0,
    revisionSuccessRate: 0,
  };

  const charts = data?.charts || {
    dailyActivity7Days: [],
    dailyActivity30Days: [],
    difficultyDistribution: [],
    topicProblemCounts: [],
  };

  const activityData = activityWindow === '7d' ? charts.dailyActivity7Days : charts.dailyActivity30Days;
  const topicData = (charts.topicProblemCounts || []).slice(0, 6);

  // Recent problems (up to 5)
  const recent = problems.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Header with Timezone Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} · Timezone:{' '}
            <span className="font-mono text-gray-700 font-medium">{metrics.timezone || 'UTC'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/add')}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span>+</span> Log New Problem
          </button>
        </div>
      </div>

      {/* Primary Dashboard Metrics Grid (8 Core Required Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3.5">
        <StatCard
          label="Total Recorded"
          value={metrics.totalProblems}
          sub="all problems"
          icon={CheckCircle}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatCard
          label="Solved Today"
          value={metrics.problemsSolvedToday}
          sub={`Goal: ${metrics.dailyGoal}/day`}
          icon={Clock}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Current Streak"
          value={`${metrics.currentStreak}d`}
          sub={metrics.currentStreak > 0 ? 'streak active' : 'no activity'}
          icon={Flame}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
        />
        <StatCard
          label="Due Revision"
          value={metrics.problemsDueForRevision}
          sub={`${metrics.overdueCount} overdue`}
          icon={RotateCcw}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Independent"
          value={`${metrics.independentSolvingRate}%`}
          sub="solve rate"
          icon={Sparkles}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          label="Better Review"
          value={`${metrics.betterSolutionReviewRate}%`}
          sub="reviewed"
          icon={CheckCheck}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          label="Easy / Med / Hard"
          value={`${metrics.difficultyCounts.Easy}/${metrics.difficultyCounts.Medium}/${metrics.difficultyCounts.Hard}`}
          sub="by difficulty"
          icon={Brain}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
        />
        <StatCard
          label="Daily Goals"
          value={`${metrics.dailyProblemGoalProgress}%`}
          sub={`${metrics.problemsSolvedToday}/${metrics.dailyProblemGoal} prob · ${metrics.revisionsCompletedToday}/${metrics.dailyRevisionGoal} rev`}
          icon={Target}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />
      </div>

      {/* Daily Goals Progress (Problems Solved + Revisions Completed) */}
      <div className="p-4 bg-white border border-gray-200/90 rounded-xl shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900">Today's Daily Practice Goals</h2>
          </div>
          {metrics.allDailyGoalsMet ? (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              🎉 All daily goals achieved!
            </span>
          ) : (
            <span className="text-xs text-gray-500">
              Configure targets in{' '}
              <button
                onClick={() => navigate('/settings')}
                className="text-indigo-600 hover:underline font-semibold"
              >
                Settings
              </button>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3.5">
          {/* Goal 1: Problems Solved Per Day */}
          <div className="p-3 bg-indigo-50/40 border border-indigo-100/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900">Problem Solving Goal</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                {metrics.problemsSolvedToday} / {metrics.dailyProblemGoal} solved
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  metrics.dailyProblemGoalProgress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${metrics.dailyProblemGoalProgress}%` }}
              />
            </div>
            <p className="text-2xs text-gray-500">
              {metrics.dailyProblemGoalProgress >= 100
                ? '✓ Daily solving target reached!'
                : `${Math.max(0, metrics.dailyProblemGoal - metrics.problemsSolvedToday)} more problem${Math.max(0, metrics.dailyProblemGoal - metrics.problemsSolvedToday) === 1 ? '' : 's'} needed today`}
            </p>
          </div>

          {/* Goal 2: Revisions Completed Per Day */}
          <div className="p-3 bg-emerald-50/40 border border-emerald-100/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">Revision Practice Goal</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {metrics.revisionsCompletedToday} / {metrics.dailyRevisionGoal} completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  metrics.dailyRevisionGoalProgress >= 100 ? 'bg-emerald-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${metrics.dailyRevisionGoalProgress}%` }}
              />
            </div>
            <p className="text-2xs text-gray-500">
              {metrics.dailyRevisionGoalProgress >= 100
                ? '✓ Daily revision target reached!'
                : `${Math.max(0, metrics.dailyRevisionGoal - metrics.revisionsCompletedToday)} more revision${Math.max(0, metrics.dailyRevisionGoal - metrics.revisionsCompletedToday) === 1 ? '' : 's'} needed today`}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Heatmap Calendar */}
      <Card>
        <CardHeader
          title="Activity Heatmap Calendar"
          subtitle="Daily problem solving and spaced repetition activity over the past year"
          action={
            <span className="text-xs font-medium text-gray-500">
              Evaluated in <span className="font-mono text-gray-700 font-semibold">{metrics.timezone || 'UTC'}</span>
            </span>
          }
        />
        <CardBody>
          <ActivityCalendar calendar={data?.calendar} />
        </CardBody>
      </Card>

      {/* Spaced-Repetition Revision Status Banner */}
      <div className="p-4 bg-white border border-gray-200/90 rounded-xl shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-indigo-600" />
            <h2 className="text-sm font-bold text-gray-900">Spaced-Repetition Revision Status</h2>
          </div>
          <button
            onClick={() => navigate('/revision')}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors flex items-center gap-1"
          >
            Open Revision Center <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 pt-3.5">
          <div className="p-3 bg-red-50/70 border border-red-100 rounded-lg">
            <p className="text-xs font-semibold text-red-700">Overdue</p>
            <p className="text-xl font-bold text-red-900 mt-0.5">{metrics.overdueCount}</p>
          </div>
          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg">
            <p className="text-xs font-semibold text-amber-700">Due Today</p>
            <p className="text-xl font-bold text-amber-900 mt-0.5">{metrics.dueTodayCount}</p>
          </div>
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg">
            <p className="text-xs font-semibold text-indigo-700">Due This Week</p>
            <p className="text-xl font-bold text-indigo-900 mt-0.5">{metrics.dueThisWeekCount}</p>
          </div>
          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg">
            <p className="text-xs font-semibold text-emerald-700">Total Revisions</p>
            <p className="text-xl font-bold text-emerald-900 mt-0.5">{metrics.totalRevisionsCount}</p>
          </div>
          <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-lg">
            <p className="text-xs font-semibold text-purple-700">Revision Success Rate</p>
            <p className="text-xl font-bold text-purple-900 mt-0.5">
              {metrics.totalRevisionsCount > 0 ? `${metrics.revisionSuccessRate}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Activity Chart & Difficulty Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Activity Chart (7 Days vs 30 Days Toggle) */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Daily Activity"
            subtitle={`Problems solved and revisions completed (${activityWindow === '7d' ? 'Last 7 days' : 'Last 30 days'})`}
            action={
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setActivityWindow('7d')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activityWindow === '7d' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setActivityWindow('30d')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activityWindow === '30d' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  30 Days
                </button>
              </div>
            }
          />
          <CardBody>
            {activityData.length === 0 || activityData.every((d) => d.totalActivity === 0) ? (
              <div className="py-8 text-center">
                <BarChart2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-500">No activity recorded in this period</p>
                <p className="text-xs text-gray-400 mt-0.5">Solve a problem or complete a revision to build your activity streak!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={activityData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: 'none' }}
                    labelStyle={{ fontWeight: 600, color: '#111' }}
                    cursor={{ fill: '#f3f4f6' }}
                  />
                  <Bar dataKey="problemsSolved" fill="#6366f1" radius={[4, 4, 0, 0]} name="Problems Solved" />
                  <Bar dataKey="revisionsCompleted" fill="#10b981" radius={[4, 4, 0, 0]} name="Revisions Completed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* Difficulty Distribution Chart */}
        <Card>
          <CardHeader title="Difficulty Breakdown" subtitle="Distribution of recorded problems" />
          <CardBody>
            {metrics.totalProblems === 0 ? (
              <EmptyState title="No problems recorded yet" description="Add your first problem to see your difficulty distribution." />
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={charts.difficultyDistribution.filter((d) => d.count > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {charts.difficultyDistribution.map((d) => (
                        <Cell key={d.name} fill={DIFF_COLORS[d.name] || '#6366f1'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-around items-center pt-2 border-t border-gray-100">
                  {charts.difficultyDistribution.map((d) => (
                    <div key={d.name} className="text-center">
                      <p className="text-base font-bold" style={{ color: DIFF_COLORS[d.name] }}>
                        {d.count}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {d.name} ({d.percentage}%)
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Bottom Row: Recent Problems & Top Topics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Problems */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent Problems"
            subtitle="Latest problems logged into your vault"
            action={
              <button
                onClick={() => navigate('/library')}
                className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
              >
                View Library <ArrowRight size={13} />
              </button>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No problems yet"
              description="Add your first problem to start tracking patterns."
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {recent.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/problems/${p.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400">
                      {p.platform} · {p.solvingDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <DifficultyBadge difficulty={p.difficulty} />
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top DSA Topics */}
        <Card>
          <CardHeader
            title="Top DSA Topics"
            subtitle="Most practiced problem patterns"
            action={
              <button
                onClick={() => navigate('/analytics')}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Details
              </button>
            }
          />
          <CardBody>
            {topicData.length === 0 ? (
              <EmptyState title="No topics logged" description="Add problem topics to see your focus areas." />
            ) : (
              <div className="space-y-3">
                {topicData.map((t, i) => (
                  <div key={t.topic} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: TOPIC_PALETTE[i % TOPIC_PALETTE.length] }}
                      />
                      <span className="text-xs font-medium text-gray-800 truncate">{t.topic}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                      {t.count} {t.count === 1 ? 'prob' : 'probs'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
