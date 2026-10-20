import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Circle, CheckSquare, Square,
  Clock, BookOpen, ChevronRight, Trophy, Zap, Lock,
  AlertCircle, GraduationCap, Target, Star,
} from 'lucide-react';
import { csFundamentalsService } from '../services/csFundamentalsService';
import { LoadingState, ErrorState } from '../components/States';
import { Card, CardBody } from '../components/Card';


// ── Overall progress mini-bar ─────────────────────────────────────────────────
function MiniProgress({ value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 shrink-0">{pct}%</span>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function TopicStatusBadge({ status }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <CheckCircle size={12} /> Completed
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
        <Zap size={12} /> In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
      <Lock size={12} /> Locked
    </span>
  );
}

// ── Checklist item ────────────────────────────────────────────────────────────
function ChecklistItem({ item, disabled, onToggle }) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      await onToggle(item.id, !item.checked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled || loading}
      className={`w-full flex items-start gap-3 text-left p-3 rounded-lg border transition-colors ${
        item.checked
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-gray-50 border-gray-200 hover:bg-indigo-50 hover:border-indigo-200'
      } ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="shrink-0 mt-0.5">
        {item.checked
          ? <CheckSquare size={17} className="text-emerald-600" />
          : <Square size={17} className="text-gray-400" />}
      </div>
      <span className={`text-sm leading-relaxed ${item.checked ? 'text-emerald-800 line-through decoration-emerald-400' : 'text-gray-700'}`}>
        {item.text}
      </span>
    </button>
  );
}

// ── Main topic detail page ────────────────────────────────────────────────────
export default function CSFundamentalsTopic() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completionSuccess, setCompletionSuccess] = useState(null); // { next_topic, curriculum_complete }
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [stats, setStats] = useState(null);
  // Assessment status: { is_mandatory, has_passed, assessment_required, has_questions }
  const [assessmentStatus, setAssessmentStatus] = useState(null);


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topicRes, statsRes] = await Promise.all([
        csFundamentalsService.getTopic(id),
        csFundamentalsService.getStats(),
      ]);
      setTopic(topicRes);
      setStats(statsRes);
      // Load assessment status (non-fatal — don't block the page if it fails)
      if (topicRes.status === 'active' || topicRes.status === 'completed') {
        csFundamentalsService.getAssessment(topicRes.id)
          .then((a) => setAssessmentStatus({
            is_mandatory: a.config?.is_mandatory ?? false,
            has_passed: a.has_passed ?? false,
            assessment_required: a.config?.is_mandatory && !a.has_passed,
            has_questions: a.has_questions ?? false,
            passing_score: a.config?.passing_score ?? 70,
            attempt_count: a.attempts?.length ?? 0,
          }))
          .catch(() => setAssessmentStatus(null));
      }
    } catch (e) {
      setError(e.message || 'Failed to load topic.');
    } finally {
      setLoading(false);
    }
  }, [id]);


  useEffect(() => {
    load();
    setCompletionSuccess(null);
    setConfirmComplete(false);
  }, [load]);

  const handleToggleChecklist = useCallback(async (itemId, checked) => {
    try {
      await csFundamentalsService.toggleChecklistItem(topic.id, itemId, checked);
      setTopic((prev) => ({
        ...prev,
        checklist_items: prev.checklist_items.map((ci) =>
          ci.id === itemId ? { ...ci, checked } : ci
        ),
      }));
    } catch (e) {
      // Revert is handled automatically since we didn't optimistically update state yet
      console.error('Checklist toggle failed:', e);
    }
  }, [topic]);

  const handleComplete = async () => {
    if (!topic || completing) return;
    setCompleting(true);
    try {
      const result = await csFundamentalsService.completeTopic(topic.id);
      setCompletionSuccess(result);
      setTopic((prev) => ({ ...prev, completed: true, status: 'completed' }));
      setStats((prev) => prev ? {
        ...prev,
        completed_topics: result.stats.completed_topics,
        completion_percentage: result.stats.completion_percentage,
      } : prev);
    } catch (e) {
      setError(e.message || 'Failed to complete topic.');
    } finally {
      setCompleting(false);
      setConfirmComplete(false);
    }
  };

  if (loading) return <LoadingState message="Loading topic..." />;
  if (error)   return <ErrorState message={error} onRetry={load} />;
  if (!topic)  return null;

  const isActive    = topic.status === 'active';
  const isCompleted = topic.status === 'completed';
  const isLocked    = topic.status === 'locked';

  const hasChecklist     = topic.checklist_items && topic.checklist_items.length > 0;
  const allItemsChecked  = hasChecklist && topic.checklist_items.every((ci) => ci.checked);
  const someItemsChecked = hasChecklist && topic.checklist_items.some((ci) => ci.checked);
  const checkedCount     = hasChecklist ? topic.checklist_items.filter((ci) => ci.checked).length : 0;
  const totalItems       = hasChecklist ? topic.checklist_items.length : 0;

  // Assessment gate: mandatory assessment not yet passed blocks completion
  const assessmentBlocked = isActive && assessmentStatus?.assessment_required === true;

  // Completion button is enabled when:
  //  - topic is active (not locked or already completed)
  //  - either no checklist items, or confirmComplete is true (confirmation toggle)
  //  - mandatory assessment passed (or no mandatory assessment)
  const canComplete = isActive && !isCompleted && !completing && !assessmentBlocked && (
    !hasChecklist || confirmComplete
  );


  return (
    <div className="space-y-5 min-w-0 max-w-3xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
        <Link to="/cs-fundamentals" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
          <GraduationCap size={13} /> CS Fundamentals
        </Link>
        <ChevronRight size={12} />
        <span className="text-gray-400">{topic.module_title}</span>
        <ChevronRight size={12} />
        <span className="text-gray-400">{topic.section_title}</span>
        <ChevronRight size={12} />
        <span className="font-medium text-gray-700 truncate">{topic.title}</span>
      </nav>

      {/* Overall progress bar */}
      {stats && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 shrink-0">
            {stats.completed_topics}/{stats.total_topics} topics
          </span>
          <div className="flex-1">
            <MiniProgress value={stats.completed_topics} max={stats.total_topics} />
          </div>
        </div>
      )}

      {/* Completion success banner */}
      {completionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              {completionSuccess.curriculum_complete ? (
                <>
                  <p className="font-bold text-emerald-900">🎉 Curriculum Complete!</p>
                  <p className="text-sm text-emerald-700">You've finished all {stats?.total_topics} topics. Amazing achievement!</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-emerald-900">Topic Completed!</p>
                  {completionSuccess.next_topic && (
                    <p className="text-sm text-emerald-700">
                      Next up: <span className="font-semibold">{completionSuccess.next_topic.title}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          {!completionSuccess.curriculum_complete && completionSuccess.next_topic && (
            <button
              onClick={() => navigate(`/cs-fundamentals/topics/${completionSuccess.next_topic.id}`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
            >
              Next Topic <ChevronRight size={14} />
            </button>
          )}
          {completionSuccess.curriculum_complete && (
            <button
              onClick={() => navigate('/cs-fundamentals')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
            >
              View Summary
            </button>
          )}
        </div>
      )}

      {/* Locked warning */}
      {isLocked && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <Lock size={18} className="text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">This topic is locked</p>
            <p className="text-xs text-amber-700 mt-0.5">Complete your current active topic to unlock this one.</p>
          </div>
        </div>
      )}

      {/* Topic header */}
      <div className="bg-white border border-gray-200/90 rounded-xl shadow-2xs p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Module {topic.module_seq} · {topic.module_title}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{topic.title}</h1>
            {topic.description && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{topic.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <TopicStatusBadge status={topic.status} />
              {topic.est_minutes && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} /> ~{topic.est_minutes} min
                </span>
              )}
              {hasChecklist && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <BookOpen size={12} /> {checkedCount}/{totalItems} checklist items
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Learning objectives */}
      {topic.objectives && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-indigo-600" />
              Learning Objectives
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{topic.objectives}</p>
          </CardBody>
        </Card>
      )}

      {/* Checklist */}
      {hasChecklist && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare size={16} className="text-indigo-600" />
                Study Checklist
              </h2>
              <span className="text-xs font-semibold text-gray-500">
                {checkedCount}/{totalItems} done
              </span>
            </div>

            {/* Checklist progress bar */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${allItemsChecked ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {topic.checklist_items.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  disabled={isLocked || (isCompleted && !isActive)}
                  onToggle={handleToggleChecklist}
                />
              ))}
            </div>

            {hasChecklist && !allItemsChecked && isActive && (
              <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                <AlertCircle size={12} />
                Check all items to enable completion (or confirm below).
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── Knowledge Assessment section ─────────────────────────────────────── */}
      {!isLocked && assessmentStatus?.has_questions && (
        <Card className={assessmentBlocked ? 'border-red-200 ring-1 ring-red-100' : ''}>
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  assessmentStatus.has_passed ? 'bg-emerald-100' :
                  assessmentStatus.is_mandatory ? 'bg-red-100' : 'bg-indigo-100'
                }`}>
                  {assessmentStatus.has_passed
                    ? <CheckCircle size={18} className="text-emerald-600" />
                    : assessmentStatus.is_mandatory
                    ? <AlertCircle size={18} className="text-red-600" />
                    : <Target size={18} className="text-indigo-600" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-gray-900">Knowledge Assessment</h2>
                    {assessmentStatus.is_mandatory && !assessmentStatus.has_passed && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                        Required — {assessmentStatus.passing_score}% to pass
                      </span>
                    )}
                    {assessmentStatus.is_mandatory && assessmentStatus.has_passed && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        ✓ Passed
                      </span>
                    )}
                    {!assessmentStatus.is_mandatory && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        <Star size={9} className="inline mr-0.5" />Optional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {assessmentStatus.has_passed
                      ? `Passed${assessmentStatus.attempt_count > 1 ? ` (${assessmentStatus.attempt_count} attempt${assessmentStatus.attempt_count !== 1 ? 's' : ''})` : ''}`
                      : assessmentStatus.attempt_count > 0
                      ? `Not passed yet — ${assessmentStatus.attempt_count} attempt${assessmentStatus.attempt_count !== 1 ? 's' : ''} taken`
                      : 'Not attempted yet'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/cs-fundamentals/topics/${topic.id}/assessment`)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  assessmentStatus.has_passed
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : assessmentStatus.is_mandatory
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {assessmentStatus.has_passed ? 'Review' : assessmentStatus.attempt_count > 0 ? 'Retake' : 'Start'}
                <ChevronRight size={12} />
              </button>
            </div>

            {assessmentBlocked && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-800 font-medium flex items-center gap-1.5">
                  <AlertCircle size={13} className="shrink-0" />
                  You must pass the knowledge assessment before marking this topic complete.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Completion section */}
      {!isLocked && !completionSuccess && (
        <div className="bg-white border border-gray-200/90 rounded-xl shadow-2xs p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            {isCompleted ? '✓ Topic Completed' : 'Mark Topic Complete'}
          </h2>

          {isCompleted ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">
                Completed{topic.completed_at ? ` on ${new Date(topic.completed_at).toLocaleDateString()}` : ''}
              </span>
            </div>
          ) : isActive ? (
            <div className="space-y-3">
              {hasChecklist && !allItemsChecked && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    className={`mt-0.5 w-4 h-4 border-2 rounded flex items-center justify-center transition-colors shrink-0 ${
                      confirmComplete ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 group-hover:border-indigo-400'
                    }`}
                    onClick={() => setConfirmComplete((v) => !v)}
                  >
                    {confirmComplete && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-sm text-gray-700 leading-snug select-none" onClick={() => setConfirmComplete((v) => !v)}>
                    I confirm I have studied this topic and am ready to mark it as complete.
                  </span>
                </label>
              )}

              {!hasChecklist && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div
                    className={`mt-0.5 w-4 h-4 border-2 rounded flex items-center justify-center transition-colors shrink-0 ${
                      confirmComplete ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 group-hover:border-indigo-400'
                    }`}
                    onClick={() => setConfirmComplete((v) => !v)}
                  >
                    {confirmComplete && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span className="text-sm text-gray-700 leading-snug select-none" onClick={() => setConfirmComplete((v) => !v)}>
                    I have studied this topic and am ready to proceed to the next one.
                  </span>
                </label>
              )}

              <button
                onClick={handleComplete}
                disabled={!canComplete}
                className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  canComplete
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {completing ? (
                  <><span className="animate-spin">⏳</span> Completing…</>
                ) : (
                  <><CheckCircle size={16} /> Mark Topic Complete</>
                )}
              </button>

              {hasChecklist && allItemsChecked && !confirmComplete && (
                <p className="text-xs text-emerald-600 text-center">
                  ✓ All checklist items done — confirm above to complete the topic.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2 pb-6">
        {topic.prev_topic ? (
          <button
            onClick={() => navigate(`/cs-fundamentals/topics/${topic.prev_topic.id}`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={14} /> Previous
          </button>
        ) : (
          <Link
            to="/cs-fundamentals"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Curriculum
          </Link>
        )}

        {topic.next_topic && (
          <button
            onClick={() => navigate(`/cs-fundamentals/topics/${topic.next_topic.id}`)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isCompleted
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'border border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
            }`}
            disabled={!isCompleted}
            title={!isCompleted ? 'Complete this topic to unlock the next one' : ''}
          >
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
