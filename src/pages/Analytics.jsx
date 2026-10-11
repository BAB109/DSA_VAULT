import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  TrendingUp, Sparkles, CheckCheck, RotateCcw,
  BookOpen, Brain, Layers, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { problemService } from '../services/problemService';
import { Card, CardHeader, CardBody } from '../components/Card';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import ActivityCalendar from '../components/ActivityCalendar';

const DIFF_COLORS = { Easy: '#10b981', Medium: '#f59e0b', Hard: '#ef4444' };
const OUTCOME_COLORS = {
  'Solved Independently': '#10b981',
  'Solved With Hint': '#f59e0b',
  'Reviewed The Solution': '#6366f1',
  'Unable To Solve': '#ef4444',
};

function MetricKpi({ label, value, sub, icon: Icon, color = 'text-indigo-600', bg = 'bg-indigo-50' }) {
  return (
    <div className="flex items-center gap-3.5 p-4 bg-white border border-gray-100 rounded-xl shadow-2xs">
      {Icon && (
        <div className={`p-2.5 rounded-lg shrink-0 ${bg}`}>
          <Icon size={20} className={color} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-2xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [activityRange, setActivityRange] = useState('30d'); // '7d' or '30d'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const analytics = await problemService.getAnalytics();
      setData(analytics);
    } catch (e) {
      setError(e.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState message="Analyzing problem solving metrics & performance..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const topicProgress = data?.topicProgress || [];

  const total = metrics.totalProblems || 0;
  const isZeroProblems = total === 0;

  const activityData = activityRange === '7d' ? charts.dailyActivity7Days || [] : charts.dailyActivity30Days || [];
  const diffDistribution = (charts.difficultyDistribution || []).filter((d) => d.count > 0);
  const topicCounts = (charts.topicProblemCounts || []).slice(0, 10);
  const performance = charts.solvingPerformance || {
    totalAttempted: 0,
    totalSolvedWithHelp: 0,
    totalSolvedWithHint: 0,
    totalSolvedIndependently: 0,
    overallRate: 0,
    byDifficulty: [],
  };
  const revisionOutcomes = (charts.revisionOutcomes || []).filter((r) => r.count > 0);
  const mistakeCategories = charts.mistakeCategories || [];

  // Data for solving breakdown chart
  const solvingBreakdownData = [
    { name: 'Solved Independently', count: performance.totalSolvedIndependently, fill: '#10b981' },
    { name: 'Solved With Hint', count: performance.totalSolvedWithHint, fill: '#f59e0b' },
    { name: 'Solved With Help', count: performance.totalSolvedWithHelp, fill: '#6366f1' },
    { name: 'Attempted / Unsolved', count: performance.totalAttempted, fill: '#ef4444' },
  ].filter((d) => d.count > 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics & Insights</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Based on {total} recorded problems · Timezone:{' '}
            <span className="font-mono text-gray-700 font-medium">{metrics.timezone || 'UTC'}</span>
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <MetricKpi
          label="Independent Solve Rate"
          value={`${metrics.independentSolvingRate || 0}%`}
          sub={`${performance.totalSolvedIndependently || 0} solved without hints`}
          icon={Sparkles}
          color="text-indigo-600"
          bg="bg-indigo-50"
        />
        <MetricKpi
          label="Better Solution Review"
          value={`${metrics.betterSolutionReviewRate || 0}%`}
          sub="reviewed optimal approaches"
          icon={CheckCheck}
          color="text-purple-600"
          bg="bg-purple-50"
        />
        <MetricKpi
          label="Revision Success Rate"
          value={metrics.totalRevisionsCount > 0 ? `${metrics.revisionSuccessRate}%` : '—'}
          sub={`${metrics.totalRevisionsCount || 0} completed revisions`}
          icon={RotateCcw}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        <MetricKpi
          label="Current Solving Streak"
          value={`${metrics.currentStreak || 0}d`}
          sub={metrics.currentStreak > 0 ? 'consecutive active days' : 'start today!'}
          icon={TrendingUp}
          color="text-orange-500"
          bg="bg-orange-50"
        />
      </div>

      {isZeroProblems ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={BookOpen}
              title="No problem records available"
              description="Start adding problems and logging revisions to generate personalized activity charts, difficulty distributions, and topic progress insights."
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Chart 1 & 2: Daily Activity (7 Days vs 30 Days) */}
          <Card>
            <CardHeader
              title={`Daily Activity (${activityRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'})`}
              subtitle="Daily volume of problems solved and revisions completed"
              action={
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => setActivityRange('7d')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      activityRange === '7d'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    7-Day Activity
                  </button>
                  <button
                    onClick={() => setActivityRange('30d')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      activityRange === '30d'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    30-Day Activity
                  </button>
                </div>
              }
            />
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={activityData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval={activityRange === '30d' ? 3 : 0}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}
                    labelStyle={{ fontWeight: 600, color: '#111' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                  <Bar dataKey="problemsSolved" fill="#6366f1" radius={[3, 3, 0, 0]} name="Problems Solved" />
                  <Bar dataKey="revisionsCompleted" fill="#10b981" radius={[3, 3, 0, 0]} name="Revisions Completed" />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Chart 3 & Chart 4 Row: Difficulty Distribution & Topic Problem Counts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 3: Difficulty Distribution */}
            <Card>
              <CardHeader title="Difficulty Distribution" subtitle="Breakdown of recorded problem complexities" />
              <CardBody>
                {diffDistribution.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No difficulty data available.</p>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={diffDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          innerRadius={45}
                          paddingAngle={3}
                          dataKey="count"
                        >
                          {diffDistribution.map((d) => (
                            <Cell key={d.name} fill={DIFF_COLORS[d.name] || '#6366f1'} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }} />
                        <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-2 pt-2 border-t border-gray-100">
                      {diffDistribution.map((d) => (
                        <div key={d.name} className="text-center">
                          <p className="text-lg font-bold" style={{ color: DIFF_COLORS[d.name] }}>
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

            {/* Chart 4: Topic-wise Problem Counts */}
            <Card>
              <CardHeader title="Topic-Wise Problem Counts" subtitle="Top DSA categories by problem volume" />
              <CardBody>
                {topicCounts.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No topic tags recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart
                      data={topicCounts}
                      layout="vertical"
                      margin={{ top: 0, right: 30, bottom: 0, left: 60 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="topic" tick={{ fontSize: 10, fill: '#4b5563' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Problems" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Chart 5 & Chart 6 Row: Independent-Solving Performance & Revision Outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 5: Independent-Solving Performance */}
            <Card>
              <CardHeader
                title="Independent-Solving Performance"
                subtitle="Distinguishing attempted, assisted, and independent solutions"
              />
              <CardBody>
                {solvingBreakdownData.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No solving status records.</p>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={solvingBreakdownData} margin={{ top: 10, right: 10, bottom: 25, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {solvingBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* By difficulty breakdown pill indicators */}
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
                      {performance.byDifficulty.map((item) => (
                        <div key={item.difficulty} className="p-2 bg-gray-50 rounded-lg text-center">
                          <p className="text-2xs font-semibold text-gray-500">{item.difficulty} Independent</p>
                          <p className="text-sm font-bold text-gray-800 mt-0.5">
                            {item.rate}%{' '}
                            <span className="text-2xs font-normal text-gray-400">
                              ({item.independent}/{item.total})
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Chart 6: Revision Outcomes */}
            <Card>
              <CardHeader title="Revision Outcomes" subtitle="Outcome distribution across all completed spaced revisions" />
              <CardBody>
                {revisionOutcomes.length === 0 ? (
                  <div className="py-8 text-center">
                    <RotateCcw className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500">No completed revisions yet</p>
                    <p className="text-xs text-gray-400 mt-0.5">Complete problem revisions in the Revision Center to see outcome statistics.</p>
                  </div>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={170}>
                      <BarChart data={charts.revisionOutcomes} margin={{ top: 10, right: 10, bottom: 25, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                          dataKey="outcome"
                          tick={{ fontSize: 9.5, fill: '#6b7280' }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {charts.revisionOutcomes.map((entry) => (
                            <Cell key={entry.outcome} fill={OUTCOME_COLORS[entry.outcome] || '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
                      <span>Total Completed: <strong>{metrics.totalRevisionsCount}</strong></span>
                      <span>Success Rate: <strong className="text-emerald-600">{metrics.revisionSuccessRate}%</strong></span>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Chart 7: Most Frequent Mistake Categories */}
          {mistakeCategories.length > 0 && (
            <Card>
              <CardHeader
                title="Most Frequent Mistake Categories"
                subtitle="Root causes identified during initial solving attempts"
              />
              <CardBody>
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={mistakeCategories} margin={{ top: 10, right: 10, bottom: 35, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="category"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      tickLine={false}
                      axisLine={false}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} name="Occurrences" />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          )}

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

          {/* TOPIC PROGRESS TABLE */}
          <Card>
            <CardHeader
              title="Topic Progress"
              subtitle="Progress metrics per topic. High problem volume does not imply mastery; review independent solve and revision recall rates."
            />
            {topicProgress.length === 0 ? (
              <CardBody>
                <p className="text-sm text-gray-400 italic">No topic records found.</p>
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50/75 border-b border-gray-200/80 text-2xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-5 py-3">Topic</th>
                      <th className="px-5 py-3 text-center">Recorded Problems</th>
                      <th className="px-5 py-3 text-center">Solved Independently</th>
                      <th className="px-5 py-3 text-center">Revised Successfully</th>
                      <th className="px-5 py-3 text-center">Due for Revision</th>
                      <th className="px-5 py-3 text-right">Independent Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {topicProgress.map((row) => (
                      <tr key={row.topic} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3 font-semibold text-gray-900 flex items-center gap-2">
                          <Layers size={14} className="text-indigo-500 shrink-0" />
                          <span>{row.topic}</span>
                        </td>
                        <td className="px-5 py-3 text-center font-bold text-gray-800">
                          {row.totalProblems}
                        </td>
                        <td className="px-5 py-3 text-center font-medium text-emerald-700">
                          <span className="bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                            {row.solvedIndependently}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center font-medium text-blue-700">
                          <span className="bg-blue-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                            {row.revisedSuccessfully}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {row.dueForRevision > 0 ? (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-bold">
                              {row.dueForRevision} due
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">Up to date</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                            {row.independentRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
