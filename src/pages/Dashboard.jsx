import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Flame, Clock, RotateCcw, Brain,
  TrendingUp, BookOpen, AlertCircle, Target, Sparkles,
  CheckCheck, ArrowRight, BarChart2, Calendar,
  SlidersHorizontal, LayoutGrid, ListTodo
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

// Modular Widgets
import FocusTimerWidget from '../components/widgets/FocusTimerWidget';
import QuickRevisionWidget from '../components/widgets/QuickRevisionWidget';
import QuickScratchpadWidget from '../components/widgets/QuickScratchpadWidget';
import DailyTipWidget from '../components/widgets/DailyTipWidget';
import DailyTasksWidget from '../components/widgets/DailyTasksWidget';
import WidgetCustomizerModal from '../components/widgets/WidgetCustomizerModal';

const DIFF_COLORS = {
  Easy: '#10b981',
  Medium: '#f59e0b',
  Hard: '#ef4444',
};

const TOPIC_PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#84cc16'];

const WIDGETS_STORAGE_KEY = 'dsa_dashboard_widgets_v2';

const DEFAULT_WIDGET_CONFIG = [
  {
    id: 'stats-grid',
    label: 'Core Stats Grid',
    description: '8 essential metrics: total recorded, streak, today’s solve, due revisions, and rates',
    enabled: true,
    icon: CheckCircle,
  },
  {
    id: 'daily-tasks',
    label: "Today's Tasks & Checklist",
    description: "Interactive daily to-do checklist, problem solving tasks, and study agenda",
    enabled: true,
    icon: ListTodo,
  },
  {
    id: 'timer-and-revision',
    label: 'Focus Timer & Revision Queue',
    description: 'Interview countdown timer and priority queue of problems due for review',
    enabled: true,
    icon: Clock,
  },
  {
    id: 'daily-goals',
    label: "Today's Daily Practice Goals",
    description: 'Interactive progress bars for problems solved and revisions completed today',
    enabled: true,
    icon: Target,
  },
  {
    id: 'scratchpad-and-tip',
    label: 'DSA Scratchpad & Algorithmic Heuristics',
    description: 'Auto-saving code scratchpad, boilerplate templates, and high-yield interview tips',
    enabled: true,
    icon: Sparkles,
  },
  {
    id: 'activity-calendar',
    label: 'Activity Heatmap Calendar',
    description: 'Visual 365-day problem solving and spaced repetition heatmap',
    enabled: true,
    icon: Calendar,
  },
  {
    id: 'revision-status',
    label: 'Spaced-Repetition Revision Status',
    description: 'Detailed cards for overdue, due today, due this week, and overall retention rate',
    enabled: true,
    icon: RotateCcw,
  },
  {
    id: 'activity-charts',
    label: 'Activity Chart & Difficulty Breakdown',
    description: '7-day/30-day activity trend bar chart and difficulty distribution pie chart',
    enabled: true,
    icon: BarChart2,
  },
  {
    id: 'recent-and-topics',
    label: 'Recent Problems & Top Topics',
    description: 'Latest problems recorded in your vault and top practiced algorithm topics',
    enabled: true,
    icon: BookOpen,
  },
];

const loadWidgetConfig = () => {
  try {
    const saved = localStorage.getItem(WIDGETS_STORAGE_KEY);
    if (!saved) return DEFAULT_WIDGET_CONFIG;
    const parsed = JSON.parse(saved);
    const merged = [];
    parsed.forEach((item) => {
      const def = DEFAULT_WIDGET_CONFIG.find((d) => d.id === item.id);
      if (def) {
        merged.push({ ...def, enabled: item.enabled });
      }
    });
    DEFAULT_WIDGET_CONFIG.forEach((def) => {
      if (!merged.find((m) => m.id === def.id)) {
        merged.push(def);
      }
    });
    return merged;
  } catch {
    return DEFAULT_WIDGET_CONFIG;
  }
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [problems, setProblems] = useState([]);
  const [activityWindow, setActivityWindow] = useState('7d'); // '7d' or '30d'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [widgets, setWidgets] = useState(loadWidgetConfig);
  const [customizerOpen, setCustomizerOpen] = useState(false);
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

  const handleToggleWidget = (id) => {
    setWidgets((prev) => {
      const updated = prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
      localStorage.setItem(
        WIDGETS_STORAGE_KEY,
        JSON.stringify(updated.map((w) => ({ id: w.id, enabled: w.enabled })))
      );
      return updated;
    });
  };

  const handleMoveWidget = (fromIndex, toIndex) => {
    setWidgets((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      localStorage.setItem(
        WIDGETS_STORAGE_KEY,
        JSON.stringify(updated.map((w) => ({ id: w.id, enabled: w.enabled })))
      );
      return updated;
    });
  };

  const handleResetDefaults = () => {
    localStorage.removeItem(WIDGETS_STORAGE_KEY);
    setWidgets(DEFAULT_WIDGET_CONFIG);
  };

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

  const activeWidgets = widgets.filter((w) => w.enabled);

  return (
    <div className="space-y-6 min-w-0">
      {/* Page Header with Timezone Indicator & Widget Customizer Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
            <span className="text-gray-300">•</span>
            <span>
              Timezone: <span className="font-mono text-gray-700 font-semibold bg-gray-100 px-1.5 py-0.5 rounded text-xs">{metrics.timezone || 'UTC'}</span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCustomizerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-semibold rounded-lg border border-gray-200 shadow-2xs transition-colors shrink-0"
            title="Rearrange and toggle widgets"
          >
            <SlidersHorizontal size={15} className="text-gray-500" />
            <span>Customize Widgets</span>
            <span className="ml-1 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-bold text-2xs rounded-full">
              {activeWidgets.length}
            </span>
          </button>
          <button
            onClick={() => navigate('/add')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors shrink-0"
          >
            <span>+</span> Log New Problem
          </button>
        </div>
      </div>

      {/* Empty State when all widgets are hidden */}
      {activeWidgets.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center space-y-3">
          <LayoutGrid className="w-10 h-10 text-gray-300 mx-auto" />
          <h3 className="text-base font-bold text-gray-800">All dashboard widgets are currently hidden</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            You can customize your dashboard layout and choose which widgets to display anytime.
          </p>
          <button
            onClick={() => setCustomizerOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <SlidersHorizontal size={14} />
            <span>Open Widget Customizer</span>
          </button>
        </div>
      )}

      {/* Render Dynamic Modular Widgets */}
      {activeWidgets.map((widget) => {
        switch (widget.id) {
          case 'stats-grid':
            return (
              <div key="stats-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* 1. Total Recorded */}
                <StatCard
                  label="Total Recorded"
                  value={metrics.totalProblems}
                  sub="All problems in vault"
                  icon={CheckCircle}
                  iconBg="bg-indigo-50"
                  iconColor="text-indigo-600"
                />

                {/* 2. Solved Today */}
                <StatCard
                  label="Solved Today"
                  value={metrics.problemsSolvedToday}
                  sub={`Goal: ${metrics.dailyProblemGoal || metrics.dailyGoal}/day`}
                  icon={Clock}
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                />

                {/* 3. Current Streak */}
                <StatCard
                  label="Current Streak"
                  value={`${metrics.currentStreak}d`}
                  sub={metrics.currentStreak > 0 ? 'Consecutive daily activity' : 'No activity streak'}
                  icon={Flame}
                  iconBg="bg-orange-50"
                  iconColor="text-orange-500"
                />

                {/* 4. Due Revisions */}
                <StatCard
                  label="Due Revisions"
                  value={metrics.problemsDueForRevision}
                  sub={metrics.overdueCount > 0 ? `${metrics.overdueCount} overdue for review` : 'All caught up today'}
                  icon={RotateCcw}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-600"
                />

                {/* 5. Independent Solve Rate */}
                <StatCard
                  label="Independent Solve Rate"
                  value={`${metrics.independentSolvingRate}%`}
                  sub="Solved without hints or help"
                  icon={Sparkles}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                />

                {/* 6. Better Review Rate */}
                <StatCard
                  label="Better Review Rate"
                  value={`${metrics.betterSolutionReviewRate}%`}
                  sub="Optimal solution reviewed"
                  icon={CheckCheck}
                  iconBg="bg-purple-50"
                  iconColor="text-purple-600"
                />

                {/* 7. Easy / Medium / Hard */}
                <StatCard
                  label="Easy / Medium / Hard"
                  icon={Brain}
                  iconBg="bg-teal-50"
                  iconColor="text-teal-600"
                  sub={`Total ${metrics.totalProblems} by difficulty`}
                >
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {metrics.difficultyCounts?.Easy ?? 0} Easy
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      {metrics.difficultyCounts?.Medium ?? 0} Med
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      {metrics.difficultyCounts?.Hard ?? 0} Hard
                    </span>
                  </div>
                </StatCard>

                {/* 8. Daily Goals */}
                <StatCard
                  label="Daily Goals"
                  value={`${metrics.dailyProblemGoalProgress}%`}
                  icon={Target}
                  iconBg="bg-rose-50"
                  iconColor="text-rose-600"
                  sub={
                    <div className="mt-1.5 space-y-0.5 text-xs text-gray-500 font-medium">
                      <div className="flex items-center justify-between gap-2">
                        <span>Problems:</span>
                        <span className="font-bold text-gray-700">{metrics.problemsSolvedToday} / {metrics.dailyProblemGoal}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Revisions:</span>
                        <span className="font-bold text-gray-700">{metrics.revisionsCompletedToday} / {metrics.dailyRevisionGoal}</span>
                      </div>
                    </div>
                  }
                />
              </div>
            );

          case 'daily-tasks':
            return (
              <div key="daily-tasks">
                <DailyTasksWidget />
              </div>
            );
            return (
              <div key="timer-and-revision" className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0">
                <FocusTimerWidget />
                <QuickRevisionWidget metrics={metrics} />
              </div>
            );

          case 'daily-goals':
            return (
              <div key="daily-goals" className="p-4 sm:p-5 bg-white border border-gray-200/90 rounded-xl shadow-2xs">
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
                  <div className="p-3.5 sm:p-4 bg-indigo-50/40 border border-indigo-100/80 rounded-xl space-y-2.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-indigo-900">Problem Solving Goal</span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full shrink-0">
                        {metrics.problemsSolvedToday} / {metrics.dailyProblemGoal} solved
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          metrics.dailyProblemGoalProgress >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, metrics.dailyProblemGoalProgress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {metrics.dailyProblemGoalProgress >= 100
                        ? '✓ Daily solving target reached!'
                        : `${Math.max(0, metrics.dailyProblemGoal - metrics.problemsSolvedToday)} more problem${Math.max(0, metrics.dailyProblemGoal - metrics.problemsSolvedToday) === 1 ? '' : 's'} needed today`}
                    </p>
                  </div>

                  {/* Goal 2: Revisions Completed Per Day */}
                  <div className="p-3.5 sm:p-4 bg-emerald-50/40 border border-emerald-100/80 rounded-xl space-y-2.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-emerald-900">Revision Practice Goal</span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full shrink-0">
                        {metrics.revisionsCompletedToday} / {metrics.dailyRevisionGoal} completed
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          metrics.dailyRevisionGoalProgress >= 100 ? 'bg-emerald-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, metrics.dailyRevisionGoalProgress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {metrics.dailyRevisionGoalProgress >= 100
                        ? '✓ Daily revision target reached!'
                        : `${Math.max(0, metrics.dailyRevisionGoal - metrics.revisionsCompletedToday)} more revision${Math.max(0, metrics.dailyRevisionGoal - metrics.revisionsCompletedToday) === 1 ? '' : 's'} needed today`}
                    </p>
                  </div>
                </div>
              </div>
            );

          case 'scratchpad-and-tip':
            return (
              <div key="scratchpad-and-tip" className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-w-0">
                <QuickScratchpadWidget />
                <DailyTipWidget />
              </div>
            );

          case 'activity-calendar':
            return (
              <div key="activity-calendar">
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
              </div>
            );

          case 'revision-status':
            return (
              <div key="revision-status" className="p-4 bg-white border border-gray-200/90 rounded-xl shadow-xs">
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

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3.5">
                  <div className="p-3 bg-red-50/70 border border-red-100 rounded-lg min-w-0">
                    <p className="text-xs font-semibold text-red-700">Overdue</p>
                    <p className="text-xl font-bold text-red-900 mt-0.5 truncate">{metrics.overdueCount}</p>
                  </div>
                  <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-lg min-w-0">
                    <p className="text-xs font-semibold text-amber-700">Due Today</p>
                    <p className="text-xl font-bold text-amber-900 mt-0.5 truncate">{metrics.dueTodayCount}</p>
                  </div>
                  <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg min-w-0">
                    <p className="text-xs font-semibold text-indigo-700">Due This Week</p>
                    <p className="text-xl font-bold text-indigo-900 mt-0.5 truncate">{metrics.dueThisWeekCount}</p>
                  </div>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-lg min-w-0">
                    <p className="text-xs font-semibold text-emerald-700">Total Revisions</p>
                    <p className="text-xl font-bold text-emerald-900 mt-0.5 truncate">{metrics.totalRevisionsCount}</p>
                  </div>
                  <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-lg min-w-0 col-span-2 sm:col-span-1">
                    <p className="text-xs font-semibold text-purple-700">Success Rate</p>
                    <p className="text-xl font-bold text-purple-900 mt-0.5 truncate">
                      {metrics.totalRevisionsCount > 0 ? `${metrics.revisionSuccessRate}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            );

          case 'activity-charts':
            return (
              <div key="activity-charts" className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
                {/* Daily Activity Chart (7 Days vs 30 Days Toggle) */}
                <Card className="lg:col-span-2 min-w-0">
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
            );

          case 'recent-and-topics':
            return (
              <div key="recent-and-topics" className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
                {/* Recent Problems */}
                <Card className="lg:col-span-2 min-w-0">
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
            );

          default:
            return null;
        }
      })}

      {/* Widget Customizer Modal */}
      <WidgetCustomizerModal
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        widgets={widgets}
        onToggleWidget={handleToggleWidget}
        onMoveWidget={handleMoveWidget}
        onResetDefaults={handleResetDefaults}
      />
    </div>
  );
}
