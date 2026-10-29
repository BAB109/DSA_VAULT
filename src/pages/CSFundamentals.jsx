import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, CheckCircle, Lock, Zap, ChevronDown, ChevronRight,
  Trophy, Target, Clock, BarChart2, ArrowRight, GraduationCap,
  Layers, Star, Flame, CalendarDays, Briefcase, Code, Sparkles, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { csFundamentalsService } from '../services/csFundamentalsService';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { Card, CardHeader, CardBody } from '../components/Card';
import { PlacementInterviewCenter } from '../components/cs/PlacementInterviewCenter';

// ── Language color mapping ──────────────────────────────────────────────────
function LanguageBadge({ language }) {
  if (!language) return null;
  const lang = language.toUpperCase();
  let bg = 'bg-gray-100 text-gray-700 border-gray-200';
  if (lang.includes('C++')) {
    bg = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (lang.includes('PYTHON')) {
    bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (lang.includes('SQL')) {
    bg = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (lang.includes('JAVASCRIPT') || lang.includes('NODE')) {
    bg = 'bg-yellow-50 text-yellow-800 border-yellow-200';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${bg}`}>
      {language}
    </span>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ status, isOptional, isDemo }) {
  const map = {
    completed: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    active:    'bg-indigo-100 text-indigo-700 border border-indigo-200',
    unlocked:  'bg-indigo-100 text-indigo-700 border border-indigo-200',
    locked:    isDemo ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  const label = {
    completed: '✓ Completed',
    active:    '▶ In Progress',
    unlocked:  '▶ Unlocked',
    locked:    isDemo ? '▶ Unlocked (Demo)' : '🔒 Locked',
  };
  return (
    <div className="flex items-center gap-1">
      {isOptional && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          Optional
        </span>
      )}
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.locked}`}>
        {label[status] || status}
      </span>
    </div>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color = 'bg-indigo-600' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Topic row inside an expanded section ─────────────────────────────────────
function TopicRow({ topic, onOpen, isDemo }) {
  const isActive    = topic.status === 'active';
  const isCompleted = topic.status === 'completed';
  const isLocked    = !isDemo && topic.status === 'locked';

  // Check prerequisites
  const unmetPrereqs = (topic.prerequisites || []).filter((p) => !p.completed);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isLocked
          ? 'opacity-70 cursor-not-allowed bg-gray-50/50'
          : 'hover:bg-indigo-50/70 cursor-pointer'
      } ${isActive ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}
      onClick={() => (!isLocked || isDemo) && onOpen(topic.id)}
    >
      <div className="shrink-0">
        {isCompleted ? (
          <CheckCircle size={18} className="text-emerald-500" />
        ) : isActive ? (
          <Zap size={18} className="text-indigo-600" />
        ) : isDemo ? (
          <BookOpen size={18} className="text-indigo-500" />
        ) : (
          <Lock size={18} className="text-gray-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${isLocked ? 'text-gray-500' : 'text-gray-900'}`}>
            {topic.title}
          </p>
          {topic.stage && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
              {topic.stage}
            </span>
          )}
          {topic.primary_language && (
            <LanguageBadge language={topic.primary_language} />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
          {topic.est_minutes && (
            <span className="flex items-center gap-1">
              <Clock size={10} /> ~{topic.est_minutes} min
            </span>
          )}

          {isLocked && unmetPrereqs.length > 0 && !isDemo && (
            <span className="text-[11px] text-amber-700 flex items-center gap-1">
              <AlertCircle size={11} className="shrink-0" />
              Requires: {unmetPrereqs.map((p) => p.title).join(', ')}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <StatusBadge status={topic.status} isOptional={topic.is_optional} isDemo={isDemo} />
        {(!isLocked || isDemo) && <ArrowRight size={14} className="text-gray-400" />}
      </div>
    </div>
  );
}

// ── Expandable section ────────────────────────────────────────────────────────
function SectionBlock({ section, onOpenTopic, isDemo }) {
  const [open, setOpen] = useState(
    section.topics.some((t) => t.status === 'active')
  );
  const done  = section.topics.filter((t) => t.status === 'completed').length;
  const total = section.topics.length;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/70 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
          <span className="text-xs font-semibold text-gray-700 truncate">{section.title}</span>
        </div>
        <span className="text-xs text-gray-500 shrink-0 ml-2">
          {done}/{total}
        </span>
      </button>
      {open && (
        <div className="divide-y divide-gray-50 px-2 py-1">
          {section.topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} onOpen={onOpenTopic} isDemo={isDemo} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Expandable module card ────────────────────────────────────────────────────
function ModuleCard({ mod, onOpenTopic, isDemo }) {
  const [open, setOpen] = useState(
    mod.sections.some((s) => s.topics.some((t) => t.status === 'active'))
  );

  const pct = mod.total_topics > 0
    ? Math.round((mod.completed_topics / mod.total_topics) * 100)
    : 0;

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                mod.is_completed ? 'bg-emerald-100' : 'bg-indigo-100'
              }`}>
                {mod.is_completed
                  ? <Trophy size={16} className="text-emerald-600" />
                  : <Layers size={16} className="text-indigo-600" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-400">Module {mod.seq}</span>
                  {mod.is_completed && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">
                      ✓ Complete
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">{mod.title}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500">{mod.completed_topics}/{mod.total_topics}</span>
              {open
                ? <ChevronDown size={16} className="text-gray-400" />
                : <ChevronRight size={16} className="text-gray-400" />}
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={mod.completed_topics} max={mod.total_topics} color={mod.is_completed ? 'bg-emerald-500' : 'bg-indigo-600'} />
            <p className="text-xs text-gray-400 mt-1">{pct}% complete</p>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {mod.sections.map((sec) => (
            <SectionBlock key={sec.id} section={sec} onOpenTopic={onOpenTopic} isDemo={isDemo} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CSFundamentals() {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageView, setPageView] = useState('curriculum'); // 'curriculum' | 'placement'
  const [phaseFilter, setPhaseFilter] = useState('all'); // 'all' | 'phase1' | 'phase2'
  const navigate = useNavigate();

  const isDemo = session?.username?.toLowerCase() === 'demo' || Boolean(data?.curriculum?.is_demo);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [curriculumRes, statsRes] = await Promise.all([
        csFundamentalsService.getCurriculum(),
        csFundamentalsService.getStats(),
      ]);
      setData({ curriculum: curriculumRes, stats: statsRes });
    } catch (e) {
      setError(e.message || 'Failed to load curriculum.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenTopic = useCallback((topicId) => {
    navigate(`/cs-fundamentals/topics/${topicId}`);
  }, [navigate]);

  // Filter modules based on selected phase
  const filteredModules = useMemo(() => {
    if (!data?.curriculum?.modules) return [];
    if (phaseFilter === 'all') return data.curriculum.modules;

    const targetPhase = phaseFilter === 'phase1' ? 1 : 2;

    return data.curriculum.modules.map((mod) => {
      // Filter sections and topics
      const filteredSections = mod.sections.map((sec) => {
        const filteredTopics = sec.topics.filter((t) => t.phase === targetPhase);
        return {
          ...sec,
          topics: filteredTopics
        };
      }).filter((sec) => sec.topics.length > 0);

      const allTopicsInPhase = filteredSections.flatMap((s) => s.topics);
      const completedCount = allTopicsInPhase.filter((t) => t.status === 'completed').length;

      return {
        ...mod,
        sections: filteredSections,
        total_topics: allTopicsInPhase.length,
        completed_topics: completedCount,
        is_completed: allTopicsInPhase.length > 0 && completedCount === allTopicsInPhase.length
      };
    }).filter((mod) => mod.total_topics > 0);
  }, [data, phaseFilter]);

  if (loading) return <LoadingState message="Loading CS Fundamentals & Placement curriculum..." />;
  if (error)   return <ErrorState message={error} onRetry={load} />;
  if (!data)   return null;

  const { stats } = data;
  const activeTopic = stats.active_topic;

  return (
    <div className="space-y-6 min-w-0">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <GraduationCap size={26} className="text-indigo-600" />
            CS Fundamentals & Placement Prep
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Two-Phase Placement Curriculum & Parallel Interview Readiness Tracks
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeTopic && (
            <button
              onClick={() => handleOpenTopic(activeTopic.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors shrink-0"
            >
              <Zap size={14} /> Continue Active Topic
            </button>
          )}
        </div>
      </div>

      {/* Top View Selector: Curriculum Path vs Placement Center */}
      <div className="bg-gray-100/80 p-1 rounded-xl flex items-center gap-1 border border-gray-200 text-xs font-semibold w-full sm:w-fit">
        <button
          onClick={() => setPageView('curriculum')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
            pageView === 'curriculum'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BookOpen size={15} />
          Curriculum Path (Phase 1 & Phase 2)
        </button>
        <button
          onClick={() => setPageView('placement')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all ${
            pageView === 'placement'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Briefcase size={15} />
          Placement & Interview Center
        </button>
      </div>

      {pageView === 'placement' ? (
        <PlacementInterviewCenter onOpenTopic={handleOpenTopic} />
      ) : (
        <>
          {/* Demo account exploration banner */}
          {isDemo && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-900">Demo Account — Unrestricted Curriculum Access</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  All 14 modules and 169 curriculum topics are unlocked for exploration. Feel free to browse, study, inspect checklists, and take assessments across any topic.
                </p>
              </div>
            </div>
          )}

          {/* Today's Learning quick-access banner */}
          <div
            className="flex items-center justify-between gap-4 px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl cursor-pointer hover:from-orange-100 hover:to-amber-100 transition-colors"
            onClick={() => navigate('/cs-fundamentals/daily')}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                <Flame size={18} className="text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-orange-900">Today's Daily Learning Hub</p>
                <p className="text-xs text-orange-700 mt-0.5">
                  Track your active topic, daily study goals, streak, and daily practice problem
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CalendarDays size={15} className="text-orange-400" />
              <ArrowRight size={16} className="text-orange-400" />
            </div>
          </div>

          {stats.curriculum_complete && (
            <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <Trophy size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-base">🎉 Curriculum Complete!</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  You've completed all {stats.total_topics} topics across both Phase 1 and Phase 2. Outstanding achievement!
                </p>
              </div>
            </div>
          )}

          {/* Phase 1 vs Phase 2 summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-200/80 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <h3 className="text-sm font-bold text-indigo-950">Phase 1: Placement Essentials</h3>
                </div>
                <span className="text-xs font-bold text-indigo-700">
                  {stats.phase1_completed || 0} / {stats.phase1_topics || 120} topics
                </span>
              </div>
              <p className="text-xs text-indigo-800/80 mb-3">
                Core DSA patterns, OOP, OS, DBMS, Networks, and System Design foundations required for placement interviews.
              </p>
              <ProgressBar
                value={stats.phase1_completed || 0}
                max={stats.phase1_topics || 120}
                color="bg-indigo-600"
              />
            </div>

            <div className="bg-gradient-to-br from-purple-50/70 to-pink-50/50 border border-purple-200/80 rounded-xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <h3 className="text-sm font-bold text-purple-950">Phase 2: Advanced CS & Engineering</h3>
                </div>
                <span className="text-xs font-bold text-purple-700">
                  {stats.phase2_completed || 0} / {stats.phase2_topics || 49} topics
                </span>
              </div>
              <p className="text-xs text-purple-800/80 mb-3">
                Distributed Consensus (Raft/Paxos), Compilers, Advanced DS (Segment Trees), and Production Infra.
              </p>
              <ProgressBar
                value={stats.phase2_completed || 0}
                max={stats.phase2_topics || 49}
                color="bg-purple-600"
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Modules', value: stats.total_modules, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Total Topics', value: stats.total_topics, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Completed', value: stats.completed_topics, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Remaining', value: stats.remaining_topics, icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Progress', value: `${stats.completion_percentage}%`, icon: BarChart2, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white border border-gray-200/90 rounded-xl p-4 shadow-2xs flex items-center gap-3">
                <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Active topic + Recently completed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Active topic card */}
            <Card>
              <CardHeader title="Current Topic" subtitle="Your active learning focus based on satisfied prerequisites" />
              <CardBody>
                {stats.curriculum_complete ? (
                  <EmptyState
                    icon={Trophy}
                    title="Curriculum Complete!"
                    description="You've mastered all topics in this curriculum."
                  />
                ) : activeTopic ? (
                  <div
                    className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors"
                    onClick={() => handleOpenTopic(activeTopic.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                        <Zap size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                            {activeTopic.module_title}
                          </p>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-200/70 text-indigo-900">
                            Phase {activeTopic.phase || 1}
                          </span>
                          {activeTopic.stage && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-200/70 text-indigo-900">
                              {activeTopic.stage}
                            </span>
                          )}
                          {activeTopic.primary_language && (
                            <LanguageBadge language={activeTopic.primary_language} />
                          )}
                        </div>
                        <p className="text-sm font-bold text-indigo-900 mt-1 leading-tight">
                          {activeTopic.title}
                        </p>
                        {stats.current_module_progress && (
                          <p className="text-xs text-indigo-600 mt-1">
                            Module progress: {stats.current_module_progress.completed}/{stats.current_module_progress.total} topics
                          </p>
                        )}
                      </div>
                      <ArrowRight size={16} className="text-indigo-400 shrink-0 mt-1" />
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No active topic" description="Load the curriculum to get started." />
                )}
              </CardBody>
            </Card>

            {/* Recently completed */}
            <Card>
              <CardHeader title="Recently Completed" subtitle="Your last 5 completed topics" />
              <CardBody className="p-0">
                {stats.recently_completed?.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {stats.recently_completed.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleOpenTopic(t.id)}
                      >
                        <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                          <p className="text-xs text-gray-400">{t.module_title}</p>
                        </div>
                        <Star size={12} className="text-amber-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={BookOpen}
                    title="No completed topics yet"
                    description="Complete your first topic to start building momentum."
                  />
                )}
              </CardBody>
            </Card>
          </div>

          {/* Module list with Phase filter toggle */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" />
                Curriculum Modules ({filteredModules.length})
              </h2>

              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setPhaseFilter('all')}
                  className={`px-3 py-1 rounded transition-colors ${
                    phaseFilter === 'all'
                      ? 'bg-white text-gray-900 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  All Topics
                </button>
                <button
                  onClick={() => setPhaseFilter('phase1')}
                  className={`px-3 py-1 rounded transition-colors ${
                    phaseFilter === 'phase1'
                      ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Phase 1: Foundations
                </button>
                <button
                  onClick={() => setPhaseFilter('phase2')}
                  className={`px-3 py-1 rounded transition-colors ${
                    phaseFilter === 'phase2'
                      ? 'bg-purple-600 text-white shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Phase 2: Advanced CS
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredModules.map((mod) => (
                <ModuleCard key={mod.id} mod={mod} onOpenTopic={handleOpenTopic} isDemo={isDemo} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
