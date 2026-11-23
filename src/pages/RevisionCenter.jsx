import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  RotateCcw, AlertTriangle, Clock, CheckCircle2,
  Calendar, ArrowRight, ExternalLink, Sparkles, Filter
} from 'lucide-react';
import { problemService } from '../services/problemService';
import { Card, CardHeader, CardBody } from '../components/Card';
import { DifficultyBadge, ConfidenceDots, StatusBadge } from '../components/Badges';
import { LoadingState, ErrorState } from '../components/States';
import { Modal } from '../components/Modal';
import { Button, Select, Textarea, Input } from '../components/FormControls';
import { useNavigate } from 'react-router-dom';

const today = format(new Date(), 'yyyy-MM-dd');

const REVISION_OUTCOMES = [
  { value: 'Solved Independently', label: 'Solved independently — advance to next interval' },
  { value: 'Solved With Hint', label: 'Solved with a hint — use shorter interval' },
  { value: 'Reviewed The Solution', label: 'Reviewed the solution — early retry needed' },
  { value: 'Unable To Solve', label: 'Unable to solve — reset to initial interval' },
];

function categorize(problems) {
  return {
    overdue: problems
      .filter((p) => p.assessment?.nextRevisionDate && p.assessment.nextRevisionDate < today)
      .sort((a, b) => a.assessment.nextRevisionDate.localeCompare(b.assessment.nextRevisionDate)),
    dueToday: problems
      .filter((p) => p.assessment?.nextRevisionDate === today)
      .sort((a, b) => a.title.localeCompare(b.title)),
    dueThisWeek: problems
      .filter((p) => {
        const d = p.assessment?.nextRevisionDate;
        const weekEnd = format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd');
        return d && d > today && d <= weekEnd;
      })
      .sort((a, b) => a.assessment.nextRevisionDate.localeCompare(b.assessment.nextRevisionDate)),
  };
}

function RevisionRow({ problem, onRecord, onReschedule }) {
  const navigate = useNavigate();
  const nextDate = problem.assessment?.nextRevisionDate;
  const isOverdue = nextDate && nextDate < today;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-gray-50/80 transition-colors gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="text-sm font-semibold text-gray-900 hover:text-indigo-600 text-left truncate cursor-pointer transition-colors"
            onClick={() => navigate(`/problems/${problem.id}`)}
          >
            {problem.title}
          </button>
          <DifficultyBadge difficulty={problem.difficulty} />
          <StatusBadge status={problem.status} />
        </div>

        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
          <span>{problem.platform}</span>
          <span>•</span>
          <span>Stage {problem.assessment?.confidenceRating || 1}</span>
          <span>•</span>
          <span className={`inline-flex items-center gap-1 font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
            <Calendar size={12} />
            Due: {nextDate || 'Not scheduled'}
            {isOverdue && <span className="bg-red-50 text-red-700 px-1.5 py-0.2 rounded text-[11px]">Overdue</span>}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          onClick={() => onReschedule(problem)}
          className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
        >
          Reschedule
        </button>
        <Button size="sm" onClick={() => onRecord(problem)}>
          Record Outcome
        </Button>
      </div>
    </div>
  );
}

function Section({ title, count, problems, icon: Icon, iconColor, onRecord, onReschedule, emptyMsg }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Icon size={18} className={iconColor} />
            {title}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {count}
            </span>
          </span>
        }
      />
      {problems.length === 0 ? (
        <CardBody>
          <p className="text-sm text-gray-400 italic py-2">{emptyMsg}</p>
        </CardBody>
      ) : (
        <div className="divide-y divide-gray-100">
          {problems.map((p) => (
            <RevisionRow
              key={p.id}
              problem={p}
              onRecord={onRecord}
              onReschedule={onReschedule}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function RevisionCenter() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Record Outcome Modal
  const [recordTarget, setRecordTarget] = useState(null);
  const [revOutcome, setRevOutcome] = useState('Solved Independently');
  const [revNotes, setRevNotes] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // Reschedule Modal
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [savingReschedule, setSavingReschedule] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    problemService.getAll()
      .then((ps) => {
        setProblems(ps.filter((p) => p.assessment?.nextRevisionDate));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const { overdue, dueToday, dueThisWeek } = categorize(problems);

  // Open Record Modal
  const handleOpenRecord = (problem) => {
    setRecordTarget(problem);
    setRevOutcome('Solved Independently');
    setRevNotes('');
  };

  // Submit Revision Outcome
  const handleSaveRevision = async () => {
    if (!recordTarget) return;
    setSavingRecord(true);

    try {
      await problemService.recordRevision(recordTarget.id, {
        date: today,
        result: revOutcome,
        notes: revNotes,
      });

      setRecordTarget(null);
      load(); // Refetch fresh database state
    } catch (err) {
      alert(err.message || 'Failed to save revision attempt.');
    } finally {
      setSavingRecord(false);
    }
  };

  // Open Reschedule Modal
  const handleOpenReschedule = (problem) => {
    setRescheduleTarget(problem);
    setRescheduleDate(problem.assessment?.nextRevisionDate || today);
  };

  // Submit Reschedule
  const handleSaveReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate) return;
    setSavingReschedule(true);

    try {
      await problemService.reschedule(rescheduleTarget.id, rescheduleDate);
      setRescheduleTarget(null);
      load(); // Refetch fresh database state
    } catch (err) {
      alert(err.message || 'Failed to reschedule revision.');
    } finally {
      setSavingReschedule(false);
    }
  };

  // Compute revision history across all loaded problems
  const revisionHistory = problems
    .flatMap((p) => (p.revisionHistory || []).map((r) => ({
      ...r,
      problemTitle: p.title,
      problemId: p.id,
      difficulty: p.difficulty,
    })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15);

  if (loading) return <LoadingState message="Loading Revision Center..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Revision Center</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Spaced-repetition engine to help you retain problem-solving intuition and code solutions independently
        </p>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-red-50/60 border border-red-200/80 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-red-700">Overdue Revisions</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{overdue.length}</p>
          </div>
          <AlertTriangle size={28} className="text-red-400" />
        </div>

        <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700">Due Today</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{dueToday.length}</p>
          </div>
          <Clock size={28} className="text-amber-400" />
        </div>

        <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-700">Due This Week</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{dueThisWeek.length}</p>
          </div>
          <RotateCcw size={28} className="text-indigo-400" />
        </div>
      </div>

      {/* Overdue Section */}
      {overdue.length > 0 && (
        <Section
          title="Overdue"
          count={overdue.length}
          problems={overdue}
          icon={AlertTriangle}
          iconColor="text-red-600"
          onRecord={handleOpenRecord}
          onReschedule={handleOpenReschedule}
          emptyMsg="No overdue problems."
        />
      )}

      {/* Due Today Section */}
      <Section
        title="Due Today"
        count={dueToday.length}
        problems={dueToday}
        icon={Clock}
        iconColor="text-amber-600"
        onRecord={handleOpenRecord}
        onReschedule={handleOpenReschedule}
        emptyMsg="You're all caught up for today! No revisions due."
      />

      {/* Due This Week Section */}
      <Section
        title="Due This Week"
        count={dueThisWeek.length}
        problems={dueThisWeek}
        icon={RotateCcw}
        iconColor="text-indigo-600"
        onRecord={handleOpenRecord}
        onReschedule={handleOpenReschedule}
        emptyMsg="No upcoming revisions scheduled for this week."
      />

      {/* Recent Revision Log */}
      {revisionHistory.length > 0 && (
        <Card>
          <CardHeader
            title="Recent Revision Activity Log"
            subtitle="Previous outcomes and notes recorded across your problems"
          />
          <div className="divide-y divide-gray-100">
            {revisionHistory.map((r, i) => (
              <div key={r.id || i} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800 truncate">{r.problemTitle}</span>
                    <DifficultyBadge difficulty={r.difficulty} />
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        r.result === 'Solved Independently' || r.result === 'Remembered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.result === 'Solved With Hint' || r.result === 'Partially Remembered'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {r.result}
                    </span>
                  </div>
                  {r.notes && (
                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{r.notes}</p>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-400 whitespace-nowrap shrink-0">{r.date}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Record Revision Outcome Modal ──────────────────────────────────── */}
      <Modal
        isOpen={Boolean(recordTarget)}
        onClose={() => setRecordTarget(null)}
        title={`Record Revision — ${recordTarget?.title}`}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">
              How did you solve this problem today?
            </label>
            <Select
              value={revOutcome}
              onChange={(e) => setRevOutcome(e.target.value)}
            >
              {REVISION_OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Textarea
              label="Revision Observations / Notes (optional)"
              value={revNotes}
              onChange={(e) => setRevNotes(e.target.value)}
              placeholder="e.g. Remembered two-pointer logic immediately, slight hesitation on edge case."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRecordTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRevision} loading={savingRecord}>
              Save & Schedule Next
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Manual Reschedule Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title={`Reschedule — ${rescheduleTarget?.title}`}
        size="sm"
      >
        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Select a new target date to practice <strong className="text-gray-800">{rescheduleTarget?.title}</strong>:
          </p>
          <Input
            label="Next Revision Date"
            type="date"
            value={rescheduleDate}
            onChange={(e) => setRescheduleDate(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveReschedule} loading={savingReschedule}>
              Save New Date
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
