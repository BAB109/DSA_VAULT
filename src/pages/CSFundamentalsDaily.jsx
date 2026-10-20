import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, Calendar, CheckCircle, Circle, Zap, ArrowRight,
  BookOpen, Trophy, Target, Clock, BarChart2, ChevronDown,
  ChevronUp, History, Star, TrendingUp, RefreshCw,
} from 'lucide-react';
import { csFundamentalsService } from '../services/csFundamentalsService';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Card, CardHeader, CardBody } from '../components/Card';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function friendlyDay(day) {
  try {
    const d = new Date(`${day}T12:00:00`);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const fmtShort = (dt) =>
      new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
    if (fmtShort(d) === fmtShort(today)) return 'Today';
    if (fmtShort(d) === fmtShort(yesterday)) return 'Yesterday';
    return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  } catch {
    return day;
  }
}

function activityLabel(activity) {
  const map = {
    started: 'Started studying',
    checklist_updated: 'Updated checklist',
    completed: 'Completed topic',
  };
  return map[activity] || activity;
}

function activityColor(activity) {
  if (activity === 'completed') return 'text-emerald-600';
  if (activity === 'checklist_updated') return 'text-indigo-600';
  return 'text-blue-500';
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ value, max, size = 80, strokeWidth = 7, color = '#4f46e5' }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ── Streak badge ──────────────────────────────────────────────────────────────
function StreakBadge({ streak }) {
  if (!streak) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">
      <Flame size={13} className="shrink-0" />
      {streak} day{streak !== 1 ? 's' : ''} streak
    </span>
  );
}

// ── Mini progress bar ─────────────────────────────────────────────────────────
function MiniBar({ value, max, color = 'bg-indigo-600' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div className={`h-1.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Checklist item (interactive in daily view) ────────────────────────────────
function DailyChecklistItem({ item, topicId, onToggle, disabled }) {
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    if (saving || disabled) return;
    setSaving(true);
    try {
      await onToggle(topicId, item.id, !item.checked);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={saving || disabled}
      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        item.checked ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-gray-50'
      }`}
    >
      <span className="shrink-0 mt-0.5">
        {item.checked
          ? <CheckCircle size={16} className="text-emerald-500" />
          : <Circle size={16} className="text-gray-300" />}
      </span>
      <span className={`text-sm leading-snug ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {item.text}
      </span>
    </button>
  );
}

// ── Today's Active Topic Card ─────────────────────────────────────────────────
function TodayTopicCard({ daily, onToggleChecklist, onContinue, onRefresh }) {
  const { active_topic, curriculum_complete, daily_goals } = daily;
  const [showChecklist, setShowChecklist] = useState(true);

  if (curriculum_complete) {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center py-8 gap-3 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <Trophy size={32} className="text-emerald-600" />
            </div>
            <p className="font-bold text-emerald-900 text-lg">🎉 Curriculum Complete!</p>
            <p className="text-sm text-emerald-700">
              You've completed all topics. Review any topic from the full curriculum below.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!active_topic) return null;

  const checkedCount = active_topic.checklist_items?.filter((i) => i.checked).length ?? 0;
  const totalItems   = active_topic.checklist_items?.length ?? 0;

  return (
    <Card className="border-indigo-200 ring-1 ring-indigo-100">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-50 to-white border-b border-indigo-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <Zap size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider truncate">
                {active_topic.module_title} · {active_topic.section_title}
              </p>
              <h2 className="text-base font-bold text-gray-900 leading-tight mt-0.5">
                {active_topic.title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {active_topic.est_minutes && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                <Clock size={12} /> ~{active_topic.est_minutes} min
              </span>
            )}
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Daily goal progress */}
        {totalItems > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <ProgressRing value={checkedCount} max={totalItems} size={52} strokeWidth={5} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-indigo-700">
                {checkedCount}/{totalItems}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 font-medium">Checklist progress</p>
              <MiniBar value={checkedCount} max={totalItems} />
              <p className="text-xs text-gray-400 mt-1">
                Daily goal: {daily_goals.checklist_progress}/{daily_goals.checklist_goal} items today
                {daily_goals.checklist_met && (
                  <span className="ml-1.5 text-emerald-600 font-semibold">✓ Goal met!</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Objectives */}
      {active_topic.objectives && (
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Learning Objectives
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{active_topic.objectives}</p>
        </div>
      )}

      {/* Checklist */}
      {active_topic.checklist_items?.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100">
          <button
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-700 transition-colors"
            onClick={() => setShowChecklist((v) => !v)}
          >
            {showChecklist ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Subtopics ({checkedCount}/{totalItems})
          </button>
          {showChecklist && (
            <div className="space-y-1">
              {active_topic.checklist_items.map((item) => (
                <DailyChecklistItem
                  key={item.id}
                  item={item}
                  topicId={active_topic.id}
                  onToggle={onToggleChecklist}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          Topic #{active_topic.global_seq}
        </p>
        <button
          onClick={() => onContinue(active_topic.id)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
        >
          Open Topic Page <ArrowRight size={14} />
        </button>
      </div>
    </Card>
  );
}

// ── Study History Table ────────────────────────────────────────────────────────
function StudyHistorySection({ history, onOpenTopic, loading }) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <RefreshCw size={14} className="animate-spin" /> Loading history…
      </div>
    );
  }

  if (!history || history.days?.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No study history yet"
        description="Start studying a topic to build your history."
      />
    );
  }

  const days = history.days;

  return (
    <div className="space-y-4">
      <button
        className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-indigo-600 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <History size={16} className="text-indigo-500" />
        Study History
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="space-y-3">
          {days.map(({ day, entries }) => (
            <div key={day} className="bg-white border border-gray-200/90 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <Calendar size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-700">{friendlyDay(day)}</span>
                <span className="text-xs text-gray-400 ml-auto">{day}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onOpenTopic(e.topic_id)}
                  >
                    <span className={`text-xs font-semibold ${activityColor(e.activity)} shrink-0 w-28`}>
                      {activityLabel(e.activity)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{e.topic_title}</p>
                      <p className="text-xs text-gray-400">{e.module_title}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {e.topic_completed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle size={11} /> Done
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">In progress</span>
                      )}
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(e.logged_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CSFundamentalsDaily() {
  const navigate = useNavigate();
  const [daily, setDaily]       = useState(null);
  const [history, setHistory]   = useState(null);
  const [streak, setStreak]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [histLoading, setHistLoading] = useState(true);
  const [error, setError]       = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadDaily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, s] = await Promise.all([
        csFundamentalsService.getDaily(),
        csFundamentalsService.getLearningStreak(),
      ]);
      if (mounted.current) {
        setDaily(d);
        setStreak(s);
      }
    } catch (e) {
      if (mounted.current) setError(e.message || 'Failed to load daily data.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const h = await csFundamentalsService.getHistory();
      if (mounted.current) setHistory(h);
    } catch {
      // Non-fatal — history is supplemental
    } finally {
      if (mounted.current) setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDaily();
    loadHistory();
  }, [loadDaily, loadHistory]);

  const handleToggleChecklist = useCallback(async (topicId, itemId, checked) => {
    // Optimistic UI update
    setDaily((prev) => {
      if (!prev?.active_topic) return prev;
      const updatedItems = prev.active_topic.checklist_items.map((i) =>
        i.id === itemId ? { ...i, checked } : i
      );
      const newCheckedToday = checked
        ? prev.daily_goals.checklist_progress + 1
        : Math.max(0, prev.daily_goals.checklist_progress - 1);
      return {
        ...prev,
        active_topic: { ...prev.active_topic, checklist_items: updatedItems },
        daily_goals: {
          ...prev.daily_goals,
          checklist_progress: newCheckedToday,
          checklist_met: newCheckedToday >= prev.daily_goals.checklist_goal,
        },
        studied_today: true,
      };
    });

    try {
      await csFundamentalsService.toggleChecklistItem(topicId, itemId, checked);
      // Reload streak asynchronously
      csFundamentalsService.getLearningStreak().then((s) => {
        if (mounted.current) setStreak(s);
      });
      // Reload history after a short delay
      setTimeout(() => { if (mounted.current) loadHistory(); }, 500);
    } catch (err) {
      // Revert on failure
      setDaily((prev) => {
        if (!prev?.active_topic) return prev;
        const revertedItems = prev.active_topic.checklist_items.map((i) =>
          i.id === itemId ? { ...i, checked: !checked } : i
        );
        return { ...prev, active_topic: { ...prev.active_topic, checklist_items: revertedItems } };
      });
      console.error('Checklist toggle failed:', err);
    }
  }, [loadHistory]);

  const handleContinue = useCallback((topicId) => {
    navigate(`/cs-fundamentals/topics/${topicId}`);
  }, [navigate]);

  if (loading) return <LoadingState message="Loading today's learning..." />;
  if (error)   return <ErrorState message={error} onRetry={loadDaily} />;
  if (!daily)  return null;

  const { overall_stats, learning_streak, daily_goals, today, timezone, studied_today } = daily;

  return (
    <div className="space-y-6 min-w-0">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Flame size={24} className="text-orange-500" />
            Today's Learning
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {today
              ? new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })
              : '—'}{' '}
            <span className="text-gray-400">({timezone})</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {studied_today && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200">
              <CheckCircle size={12} /> Studied today
            </span>
          )}
          <StreakBadge streak={learning_streak} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'CS Learning Streak',
            value: `${learning_streak} day${learning_streak !== 1 ? 's' : ''}`,
            icon: Flame,
            color: 'text-orange-500',
            bg: 'bg-orange-50',
          },
          {
            label: 'Overall Progress',
            value: `${overall_stats.completion_percentage}%`,
            icon: BarChart2,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
          },
          {
            label: 'Completed',
            value: `${overall_stats.completed_topics}/${overall_stats.total_topics}`,
            icon: CheckCircle,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Checklist Today',
            value: `${daily_goals.checklist_progress}/${daily_goals.checklist_goal}`,
            icon: Target,
            color: daily_goals.checklist_met ? 'text-emerald-600' : 'text-amber-600',
            bg: daily_goals.checklist_met ? 'bg-emerald-50' : 'bg-amber-50',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-gray-200/90 rounded-xl p-4 shadow-2xs flex items-center gap-3">
            <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 leading-tight">{label}</p>
              <p className="text-base font-bold text-gray-900 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="bg-white border border-gray-200/90 rounded-xl shadow-2xs px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <TrendingUp size={15} className="text-indigo-500" /> Curriculum Progress
          </span>
          <span className="text-xs font-bold text-indigo-600">
            {overall_stats.completed_topics} / {overall_stats.total_topics} topics
          </span>
        </div>
        <MiniBar value={overall_stats.completed_topics} max={overall_stats.total_topics} color="bg-indigo-600" />
        <p className="text-xs text-gray-400 mt-1.5">
          {overall_stats.remaining_topics} topics remaining
        </p>
      </div>

      {/* Streak card */}
      {streak && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Current Streak', value: streak.current_streak, icon: Flame, color: 'text-orange-500', suffix: 'days' },
            { label: 'Longest Streak', value: streak.longest_streak, icon: Star, color: 'text-amber-500', suffix: 'days' },
            { label: 'Total Study Days', value: streak.total_study_days, icon: Calendar, color: 'text-blue-500', suffix: 'days' },
          ].map(({ label, value, icon: Icon, color, suffix }) => (
            <div key={label} className="bg-white border border-gray-200/90 rounded-xl p-4 shadow-2xs flex items-center gap-3">
              <Icon size={20} className={`${color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-semibold">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value} <span className="text-xs font-normal text-gray-400">{suffix}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today's active topic */}
      <div>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <BookOpen size={15} className="text-indigo-500" /> Active Topic
        </h2>
        <TodayTopicCard
          daily={daily}
          onToggleChecklist={handleToggleChecklist}
          onContinue={handleContinue}
          onRefresh={loadDaily}
        />
      </div>

      {/* Study history */}
      <div>
        <StudyHistorySection
          history={history}
          onOpenTopic={(id) => navigate(`/cs-fundamentals/topics/${id}`)}
          loading={histLoading}
        />
      </div>
    </div>
  );
}
