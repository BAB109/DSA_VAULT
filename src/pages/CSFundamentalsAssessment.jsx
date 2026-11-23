import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, ChevronRight, GraduationCap,
  AlertCircle, Trophy, RotateCcw, Clock, BookOpen, Star,
  ChevronDown, ChevronUp, Target, Zap, HelpCircle,
} from 'lucide-react';
import { csFundamentalsService } from '../services/csFundamentalsService';
import { LoadingState, ErrorState } from '../components/States';
import { Card, CardBody } from '../components/Card';

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, passing, size = 100 }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const passed = score >= passing;
  const color = passed ? '#10b981' : '#ef4444';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-black" style={{ color }}>{Math.round(score)}%</p>
        <p className="text-xs font-semibold" style={{ color }}>{passed ? 'Passed' : 'Failed'}</p>
      </div>
    </div>
  );
}

// ── MCQ option button ─────────────────────────────────────────────────────────
function McqOption({ option, selected, onSelect, disabled }) {
  return (
    <button
      onClick={() => !disabled && onSelect(option)}
      disabled={disabled}
      className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-semibold'
          : disabled
          ? 'border-gray-100 bg-gray-50 text-gray-500 cursor-not-allowed'
          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'
      }`}
    >
      {option}
    </button>
  );
}

// ── Single question card (taking mode) ────────────────────────────────────────
function QuestionCard({ question, index, total, answer, onChange, disabled }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-black">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              question.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
              question.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>{question.difficulty}</span>
            <span className="text-xs text-gray-400 capitalize">{question.question_type.replace('_', ' ')}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-relaxed">{question.question_text}</p>
        </div>
      </div>

      <div className="ml-10">
        {question.question_type === 'mcq' && question.options ? (
          <div className="space-y-2">
            {(Array.isArray(question.options) ? question.options : JSON.parse(question.options)).map((opt) => (
              <McqOption
                key={opt}
                option={opt}
                selected={answer === opt}
                onSelect={onChange}
                disabled={disabled}
              />
            ))}
          </div>
        ) : (
          <textarea
            value={answer || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Type your answer here…"
            rows={4}
            className="w-full px-3 py-2.5 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none text-gray-800 disabled:bg-gray-50 disabled:text-gray-500"
          />
        )}
      </div>
    </div>
  );
}

// ── Result item (review mode) ─────────────────────────────────────────────────
function ResultItem({ result, index }) {
  const [open, setOpen] = useState(!result.is_correct);
  const opts = result.options
    ? (Array.isArray(result.options) ? result.options : JSON.parse(result.options))
    : null;

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${result.is_correct ? 'border-emerald-200' : 'border-red-200'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left ${result.is_correct ? 'bg-emerald-50' : 'bg-red-50'}`}
      >
        <span className="shrink-0">
          {result.is_correct
            ? <CheckCircle size={18} className="text-emerald-600" />
            : <XCircle size={18} className="text-red-500" />}
        </span>
        <span className="flex-1 text-sm font-semibold text-gray-800 leading-snug line-clamp-2">{result.question_text}</span>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 bg-white">
          {opts && (
            <div className="space-y-1.5">
              {opts.map((opt) => {
                const isCorrect = opt.trim().toLowerCase() === result.correct_answer.trim().toLowerCase();
                const isUser    = opt.trim().toLowerCase() === result.user_answer.trim().toLowerCase();
                return (
                  <div key={opt} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                    isCorrect ? 'bg-emerald-50 border border-emerald-200' :
                    isUser && !isCorrect ? 'bg-red-50 border border-red-200' :
                    'bg-gray-50 border border-gray-100'
                  }`}>
                    <span className="shrink-0 mt-0.5">
                      {isCorrect ? <CheckCircle size={13} className="text-emerald-600" /> :
                       isUser ? <XCircle size={13} className="text-red-500" /> :
                       <span className="w-3 h-3 rounded-full bg-gray-300 inline-block" />}
                    </span>
                    <span className={`leading-snug ${isCorrect ? 'text-emerald-800 font-medium' : isUser ? 'text-red-700 line-through' : 'text-gray-600'}`}>
                      {opt}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {!opts && (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Your answer</p>
                <p className={`text-sm p-2 rounded bg-gray-50 border ${result.is_correct ? 'border-emerald-200 text-emerald-800' : 'border-red-200 text-red-800'}`}>
                  {result.user_answer || <span className="italic text-gray-400">No answer given</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Model answer</p>
                <p className="text-sm p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">{result.correct_answer}</p>
              </div>
            </div>
          )}

          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
              <BookOpen size={11} /> Explanation
            </p>
            <p className="text-sm text-blue-900 leading-relaxed">{result.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Past attempt summary row ──────────────────────────────────────────────────
function AttemptRow({ attempt, onReview }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${attempt.passed ? 'bg-emerald-100' : 'bg-red-100'}`}>
        {attempt.passed
          ? <CheckCircle size={14} className="text-emerald-600" />
          : <XCircle size={14} className="text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">Attempt #{attempt.attempt_number}</p>
        <p className="text-xs text-gray-500">
          {attempt.correct_count}/{attempt.total_questions} correct ·{' '}
          {new Date(attempt.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-sm font-black ${attempt.passed ? 'text-emerald-600' : 'text-red-500'}`}>
          {Math.round(attempt.score)}%
        </span>
        {onReview && (
          <button onClick={() => onReview(attempt)} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 hover:bg-indigo-50 rounded transition-colors">
            Review
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Assessment Page ──────────────────────────────────────────────────────
export default function CSFundamentalsAssessment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const topicId = parseInt(id, 10);

  // View states: 'loading' | 'overview' | 'taking' | 'result' | 'review'
  const [view, setView] = useState('loading');
  const [error, setError] = useState(null);

  const [assessData, setAssessData] = useState(null);   // from GET assessment
  const [answers, setAnswers] = useState({});            // { [question_id]: string }
  const [result, setResult] = useState(null);            // from POST submit
  const [submitting, setSubmitting] = useState(false);
  const [reviewAttempt, setReviewAttempt] = useState(null); // for reviewing a past attempt
  const [historyData, setHistoryData] = useState(null);
  const [topicTitle, setTopicTitle] = useState('');

  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(async () => {
    setView('loading');
    setError(null);
    try {
      const [assess, topic] = await Promise.all([
        csFundamentalsService.getAssessment(topicId),
        csFundamentalsService.getTopic(topicId).catch(() => null),
      ]);
      if (!mounted.current) return;
      setAssessData(assess);
      if (topic) setTopicTitle(topic.title);
      setView('overview');
    } catch (e) {
      if (mounted.current) { setError(e.message || 'Failed to load assessment.'); setView('loading'); }
    }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  const startAttempt = () => {
    setAnswers({});
    setResult(null);
    setView('taking');
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await csFundamentalsService.submitAssessment(topicId, answers);
      if (!mounted.current) return;
      setResult(res);
      // Refresh assessment data to update past attempts list
      const fresh = await csFundamentalsService.getAssessment(topicId).catch(() => null);
      if (mounted.current && fresh) setAssessData(fresh);
      setView('result');
    } catch (e) {
      if (mounted.current) setError(e.message || 'Failed to submit assessment.');
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const handleReviewAttempt = async (attempt) => {
    // Load full history if not yet loaded
    if (!historyData) {
      try {
        const h = await csFundamentalsService.getAssessmentAttempts(topicId);
        if (mounted.current) setHistoryData(h);
        const full = h.attempts.find((a) => a.id === attempt.id);
        if (full && mounted.current) { setReviewAttempt(full); setView('review'); }
      } catch {
        setReviewAttempt(attempt);
        setView('review');
      }
    } else {
      const full = historyData.attempts.find((a) => a.id === attempt.id);
      setReviewAttempt(full || attempt);
      setView('review');
    }
  };

  const answeredCount = Object.values(answers).filter((v) => v && v.trim()).length;
  const totalQ = assessData?.questions?.length ?? 0;
  const allAnswered = answeredCount === totalQ && totalQ > 0;

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (view === 'loading' && !error) return <LoadingState message="Loading assessment…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const config = assessData?.config ?? { is_mandatory: false, passing_score: 70 };
  const questions = assessData?.questions ?? [];
  const pastAttempts = assessData?.attempts ?? [];

  // ── Overview ─────────────────────────────────────────────────────────────
  if (view === 'overview') {
    return (
      <div className="space-y-5 max-w-2xl">
        <Breadcrumb topicId={topicId} topicTitle={topicTitle} current="Assessment" />

        <div className="bg-white border border-gray-200/90 rounded-xl shadow-2xs p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Target size={24} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">Knowledge Assessment</h1>
              <p className="text-sm text-gray-500 mt-0.5">{topicTitle}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {config.is_mandatory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                    <AlertCircle size={11} /> Mandatory — {config.passing_score}% to pass
                  </span>
                )}
                {!config.is_mandatory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    <Star size={11} /> Optional
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  <HelpCircle size={11} /> {questions.length} question{questions.length !== 1 ? 's' : ''}
                </span>
                {assessData?.has_passed && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle size={11} /> Passed
                  </span>
                )}
              </div>
            </div>
          </div>

          {questions.length === 0 ? (
            <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                No assessment questions are available for this topic yet.
                {!config.is_mandatory && ' You can complete the topic using the checklist workflow.'}
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Questions', value: questions.length, icon: HelpCircle },
                  { label: 'Pass Score', value: `${config.passing_score}%`, icon: Target },
                  { label: 'Attempts', value: pastAttempts.length, icon: RotateCcw },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <Icon size={16} className="text-gray-400 mx-auto mb-1" />
                    <p className="text-lg font-black text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={startAttempt}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                {pastAttempts.length === 0 ? 'Start Assessment' : 'Retake Assessment'}
              </button>

              <Link
                to={`/cs-fundamentals/topics/${topicId}`}
                className="block w-full py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl text-sm text-center transition-colors"
              >
                ← Back to Topic
              </Link>
            </div>
          )}
        </div>

        {/* Past attempts */}
        {pastAttempts.length > 0 && (
          <Card>
            <div className="px-5 pt-4 pb-1 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Clock size={14} className="text-gray-400" /> Past Attempts
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {pastAttempts.map((a) => (
                <AttemptRow key={a.id} attempt={a} onReview={handleReviewAttempt} />
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Taking the assessment ────────────────────────────────────────────────
  if (view === 'taking') {
    return (
      <div className="space-y-5 max-w-2xl">
        <Breadcrumb topicId={topicId} topicTitle={topicTitle} current="Assessment" />

        {/* Progress header */}
        <div className="bg-white border border-gray-200/90 rounded-xl shadow-2xs p-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 mb-1.5">
              {answeredCount} / {totalQ} answered
            </p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${totalQ > 0 ? (answeredCount / totalQ) * 100 : 0}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setView('overview')}
            className="text-xs text-gray-400 hover:text-red-500 font-semibold px-2 py-1 rounded transition-colors"
          >
            Abandon
          </button>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white border border-gray-200/90 rounded-xl shadow-2xs p-5">
              <QuestionCard
                question={q}
                index={i}
                total={questions.length}
                answer={answers[q.id] || ''}
                onChange={(val) => handleAnswerChange(q.id, val)}
                disabled={false}
              />
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="bg-white border border-gray-200/90 rounded-xl shadow-2xs p-4 sticky bottom-4">
          {!allAnswered && (
            <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
              <AlertCircle size={12} />
              {totalQ - answeredCount} question{totalQ - answeredCount !== 1 ? 's' : ''} unanswered — unanswered questions will be marked incorrect.
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || totalQ === 0}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
              submitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
            }`}
          >
            {submitting ? <><span className="animate-spin">⏳</span> Submitting…</> : <><CheckCircle size={16} /> Submit Assessment</>}
          </button>
        </div>
      </div>
    );
  }

  // ── Result view ──────────────────────────────────────────────────────────
  if (view === 'result' && result) {
    return (
      <div className="space-y-5 max-w-2xl">
        <Breadcrumb topicId={topicId} topicTitle={topicTitle} current="Assessment Results" />

        {/* Score card */}
        <div className={`p-5 sm:p-6 rounded-xl border-2 ${result.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <ScoreRing score={result.score} passing={result.passing_score} size={110} />
            <div className="text-center sm:text-left">
              <h2 className={`text-xl font-black mb-1 ${result.passed ? 'text-emerald-900' : 'text-red-900'}`}>
                {result.passed ? '🎉 Assessment Passed!' : '❌ Not Passed Yet'}
              </h2>
              <p className={`text-sm font-medium mb-3 ${result.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                {result.feedback}
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700">
                  {result.correct_count}/{result.total_questions} correct
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700">
                  Attempt #{result.attempt_number}
                </span>
                {result.is_mandatory && !result.passed && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 border border-red-200 text-red-700">
                    Pass required to complete topic
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {!result.passed && (
              <button
                onClick={startAttempt}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors"
              >
                <RotateCcw size={14} /> Try Again
              </button>
            )}
            {result.passed && (
              <Link
                to={`/cs-fundamentals/topics/${topicId}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors"
              >
                <ChevronRight size={14} /> Back to Topic
              </Link>
            )}
            <button
              onClick={() => setView('overview')}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg transition-colors"
            >
              Overview
            </button>
          </div>
        </div>

        {/* Question-by-question review */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpen size={15} className="text-indigo-500" /> Answer Review
          </h2>
          <div className="space-y-3">
            {result.results.map((r, i) => (
              <ResultItem key={r.question_id} result={r} index={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── History review view ──────────────────────────────────────────────────
  if (view === 'review' && reviewAttempt) {
    return (
      <div className="space-y-5 max-w-2xl">
        <Breadcrumb topicId={topicId} topicTitle={topicTitle} current={`Attempt #${reviewAttempt.attempt_number}`} />

        <div className={`p-5 rounded-xl border-2 ${reviewAttempt.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-900">Attempt #{reviewAttempt.attempt_number}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(reviewAttempt.submitted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
            <ScoreRing score={parseFloat(reviewAttempt.score)} passing={config.passing_score} size={80} />
          </div>
          <button onClick={() => setView('overview')} className="mt-3 text-xs text-indigo-600 font-semibold hover:underline">
            ← Back to Overview
          </button>
        </div>

        {reviewAttempt.answers && (
          <div className="space-y-3">
            {reviewAttempt.answers.map((a, i) => (
              <ResultItem key={i} result={a} index={i} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Shared breadcrumb ─────────────────────────────────────────────────────────
function Breadcrumb({ topicId, topicTitle, current }) {
  return (
    <nav className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
      <Link to="/cs-fundamentals" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
        <GraduationCap size={13} /> CS Fundamentals
      </Link>
      <ChevronRight size={12} />
      <Link to={`/cs-fundamentals/topics/${topicId}`} className="hover:text-indigo-600 transition-colors truncate max-w-[180px]">
        {topicTitle || `Topic ${topicId}`}
      </Link>
      <ChevronRight size={12} />
      <span className="font-medium text-gray-700">{current}</span>
    </nav>
  );
}
