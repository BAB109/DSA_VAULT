import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Edit2, ExternalLink, ArrowLeft, FileText, CheckCircle,
  XCircle, Clock, Calendar, Tag, AlertCircle, Lightbulb,
  History, ShieldAlert, BookOpen
} from 'lucide-react';
import { problemService } from '../services/problemService';
import { isValidDriveUrl } from '../utils/driveUrl';
import { DifficultyBadge, StatusBadge, TopicTag, ConfidenceDots, ReviewBadge } from '../components/Badges';
import { Card, CardHeader, CardBody } from '../components/Card';
import { LoadingState, ErrorState } from '../components/States';
import { Button } from '../components/FormControls';

/**
 * Clean reusable component for Google Drive notes links
 * Shows Open Notes button if valid, or a clear subtle empty state when missing.
 */
function DriveNotesSection({ title, url }) {
  const hasLink = isValidDriveUrl(url);

  return (
    <div className="p-4 bg-gray-50/70 border border-gray-200/80 rounded-xl flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${hasLink ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
          <FileText size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700">{title}</p>
          {hasLink ? (
            <p className="text-xs text-gray-500 truncate max-w-sm mt-0.5">{url}</p>
          ) : (
            <p className="text-xs text-gray-400 italic mt-0.5">No Google Drive notes link provided</p>
          )}
        </div>
      </div>

      {hasLink ? (
        <a
          href={url.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 shadow-xs transition-colors shrink-0"
        >
          <ExternalLink size={13} /> Open Notes
        </a>
      ) : (
        <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-400 rounded-lg shrink-0">
          Not attached
        </span>
      )}
    </div>
  );
}

export default function ProblemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    problemService.getById(id)
      .then((p) => {
        if (!p) {
          setError('Problem record not found in your vault.');
          return;
        }
        setProblem(p);
      })
      .catch((e) => setError(e.message || 'Failed to load problem details.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <LoadingState message="Loading problem record..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!problem) return null;

  const {
    initialApproach: initial = {},
    improvedSolution: improved = {},
    assessment = {},
    revisionHistory = [],
  } = problem;

  const initialNotes = initial.notesUrl || initial.notesImageUrl || '';
  const improvedNotes = improved.notesUrl || improved.notesImageUrl || '';
  const keyInsight = improved.keyInsight || improved.lessonsLearned || '';
  const mistakes = assessment.mistakeCategories || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate('/library')}
            className="mt-1 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            title="Back to Problem Library"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{problem.title}</h1>
              <DifficultyBadge difficulty={problem.difficulty} />
              <StatusBadge status={problem.status} />
              <ReviewBadge reviewed={improved.reviewed} />
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>Platform: <strong className="font-semibold text-gray-700">{problem.platform}</strong></span>
              <span>•</span>
              <span>Solved on: <strong className="font-semibold text-gray-700">{problem.solvingDate}</strong></span>
              {problem.timeTaken ? (
                <>
                  <span>•</span>
                  <span>Time taken: <strong className="font-semibold text-gray-700">{problem.timeTaken} min</strong></span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {problem.problemUrl && (
            <a
              href={problem.problemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <ExternalLink size={13} /> Problem Link
            </a>
          )}
          {problem.submissionUrl && (
            <a
              href={problem.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <ExternalLink size={13} /> Submission
            </a>
          )}
          <Button size="sm" onClick={() => navigate(`/problems/${id}/edit`)}>
            <Edit2 size={13} /> Edit
          </Button>
        </div>
      </div>

      {/* ── 1. PROBLEM DETAILS & TOPICS ────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="1. Problem Details"
          subtitle="Core metadata, platform specifics, and categorized DSA topics"
        />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pb-3">
            <div>
              <p className="text-xs text-gray-400 font-medium">Platform</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{problem.platform}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Difficulty</p>
              <div className="mt-1"><DifficultyBadge difficulty={problem.difficulty} /></div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Solving Status</p>
              <div className="mt-1"><StatusBadge status={problem.status} /></div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Date Solved</p>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{problem.solvingDate}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-1.5">DSA Topics</p>
            {problem.topics?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {problem.topics.map((t) => (
                  <TopicTag key={t} label={t} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No topics tagged.</p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ── 2 & 3. INITIAL APPROACH & IMPROVED SOLUTION (Side-by-Side) ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 2. Initial Approach */}
        <Card>
          <CardHeader
            title="2. Initial Approach"
            subtitle="Your first attempt and intuition"
          />
          <CardBody>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">Description</p>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {initial.description || <span className="italic text-gray-400">No initial approach description recorded.</span>}
                </p>
              </div>

              {/* Complexities */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Time Complexity</p>
                  <p className="text-xs font-mono font-semibold text-indigo-700 mt-0.5">
                    {initial.timeComplexity || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Space Complexity</p>
                  <p className="text-xs font-mono font-semibold text-indigo-700 mt-0.5">
                    {initial.spaceComplexity || '—'}
                  </p>
                </div>
              </div>

              {/* Main Difficulty */}
              {initial.mainDifficulty && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">Difficulty Encountered</p>
                  <p className="text-xs text-amber-900 leading-relaxed">{initial.mainDifficulty}</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* 3. Improved Solution */}
        <Card>
          <CardHeader
            title="3. Improved Solution"
            subtitle={improved.reviewed ? "Optimized solution from editorial or review" : "Not yet reviewed"}
          />
          <CardBody>
            {improved.reviewed ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-1">Description</p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {improved.description || <span className="italic text-gray-400">No improved description recorded.</span>}
                  </p>
                </div>

                {/* Complexities */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Time Complexity</p>
                    <p className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">
                      {improved.timeComplexity || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Space Complexity</p>
                    <p className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">
                      {improved.spaceComplexity || '—'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm text-gray-500">No improved solution has been reviewed yet.</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  You can update this record anytime by clicking "Edit" above when you check optimal solutions.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── 4. KEY INSIGHT ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="4. Key Insight & Lessons Learned"
          subtitle="Core takeaway to remember for technical interviews"
        />
        <CardBody>
          {keyInsight ? (
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start gap-3">
              <Lightbulb size={20} className="text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm text-indigo-950 font-medium leading-relaxed whitespace-pre-wrap">
                  {keyInsight}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No key insight recorded for this problem.</p>
          )}
        </CardBody>
      </Card>

      {/* ── 5. GOOGLE DRIVE NOTES LINKS ────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="5. Google Drive Notes"
          subtitle="Direct links to your handwritten notes and diagram files"
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DriveNotesSection title="Initial Approach Notes" url={initialNotes} />
            <DriveNotesSection title="Improved Solution Notes" url={improvedNotes} />
          </div>
        </CardBody>
      </Card>

      {/* ── 6. SELF-ASSESSMENT ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="6. Self-Assessment"
          subtitle="Confidence rating, independent solving capability, and revision target"
        />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1.5">Confidence Rating</p>
              <div className="flex items-center gap-2">
                <ConfidenceDots rating={assessment.confidenceRating} />
                <span className="text-xs font-semibold text-gray-700">
                  {assessment.confidenceRating} / 5
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">Independent Solving</p>
              <p className={`text-sm font-semibold flex items-center gap-1.5 ${assessment.canSolveAgain ? 'text-emerald-700' : 'text-red-600'}`}>
                {assessment.canSolveAgain ? (
                  <>
                    <CheckCircle size={15} /> Can solve independently
                  </>
                ) : (
                  <>
                    <XCircle size={15} /> Needs guidance / review
                  </>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">Next Revision Target</p>
              <p className="text-sm font-semibold text-gray-800">
                {assessment.nextRevisionDate || '—'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── 7. MISTAKES ENCOUNTERED ────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="7. Mistakes & Pitfalls"
          subtitle="Specific categories where errors or misunderstandings occurred"
        />
        <CardBody>
          {mistakes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {mistakes.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium"
                >
                  <AlertCircle size={12} />
                  {m}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No mistake categories flagged for this problem.</p>
          )}
        </CardBody>
      </Card>

      {/* ── 8. REVISION HISTORY ────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title={`8. Revision History (${revisionHistory.length})`}
          subtitle="Spaced repetition practice records and notes"
        />
        <CardBody>
          {revisionHistory.length === 0 ? (
            <div className="py-6 text-center">
              <History size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No revisions recorded yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                You can record your spaced repetition revision from the Revision Center when due.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {revisionHistory.map((rev, index) => (
                <div key={rev.id || index} className="p-3.5 bg-gray-50/80 border border-gray-100 rounded-xl flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-800">{rev.date}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          rev.result === 'Remembered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rev.result === 'Partially Remembered'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {rev.result}
                      </span>
                    </div>
                    {rev.notes && (
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {rev.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
