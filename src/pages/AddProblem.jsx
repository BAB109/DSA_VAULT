import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { problemService } from '../services/problemService';
import { validateDriveUrl, isValidDriveUrl } from '../utils/driveUrl';
import {
  Input, Textarea, Select, FormSection, FullWidth,
  Checkbox, RatingInput, TagInput, Button,
} from '../components/FormControls';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['LeetCode', 'HackerRank', 'CodeForces', 'GFG', 'InterviewBit', 'Other'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const SOLVING_STATUSES = [
  { value: 'Solved Independently', label: 'Solved independently' },
  { value: 'Solved With Hint', label: 'Solved with a hint' },
  { value: 'Solved With Help', label: 'Solved with help' },
  { value: 'Unable To Solve', label: 'Unable to solve' },
];

const MISTAKE_CATEGORIES = [
  'Off-by-one error',
  'Wrong algorithm',
  "Couldn't code it",
  'TLE',
  'Wrong complexity analysis',
  'Pointer confusion',
  'Forgot base case',
  'Edge case missed',
  'Other',
];

const TOPIC_SUGGESTIONS = [
  'Array', 'String', 'Hash Map', 'Two Pointers', 'Sliding Window',
  'Stack', 'Queue', 'Linked List', 'Tree', 'BFS', 'DFS',
  'Backtracking', 'Dynamic Programming', 'Greedy', 'Binary Search',
  'Heap', 'Graph', 'Trie', 'Divide & Conquer', 'Union Find',
  'Segment Tree', 'Bit Manipulation', 'Math', 'Design',
];

const REVISION_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

const computeRevisionDate = (confidence) =>
  format(addDays(new Date(), REVISION_INTERVALS[confidence] ?? 1), 'yyyy-MM-dd');

// ─── Initial form factory ─────────────────────────────────────────────────────

const makeInitialForm = () => ({
  title: '',
  platform: '',
  problemUrl: '',
  submissionUrl: '',
  difficulty: '',
  topics: [],
  solvingDate: format(new Date(), 'yyyy-MM-dd'),
  timeTaken: '',
  status: '',

  initialApproach: {
    description: '',
    timeComplexity: '',
    spaceComplexity: '',
    notesUrl: '',           // Google Drive link (optional)
    mainDifficulty: '',
  },

  improvedSolution: {
    reviewed: false,
    description: '',
    timeComplexity: '',
    spaceComplexity: '',
    notesUrl: '',           // Google Drive link (optional)
    keyInsight: '',
  },

  assessment: {
    confidenceRating: 3,
    canSolveAgain: true,
    mistakeCategories: [],
    nextRevisionDate: computeRevisionDate(3),
  },
});

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = ['Problem Details', 'Initial Approach', 'Improved Solution', 'Self-Assessment'];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors shrink-0
              ${i < current
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : i === current
                  ? 'bg-white border-indigo-600 text-indigo-600'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
          >
            {i < current ? '✓' : i + 1}
          </div>
          <span
            className={`ml-1.5 text-xs font-medium hidden sm:block
              ${i === current ? 'text-indigo-700' : 'text-gray-400'}`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="w-5 sm:w-8 h-px bg-gray-200 mx-2 shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// ─── Google Drive link field ──────────────────────────────────────────────────

function DriveUrlInput({ label, value, onChange, error }) {
  const hasValidLink = isValidDriveUrl(value);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://drive.google.com/… (optional)"
            className={`w-full px-3 py-2 text-sm bg-white border rounded-lg outline-none transition-colors placeholder-gray-400 text-gray-900
              ${error
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
              }`}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          {!error && (
            <p className="mt-1 text-xs text-gray-400">
              Optional · Only drive.google.com or docs.google.com links accepted
            </p>
          )}
        </div>
        {hasValidLink && (
          <a
            href={value.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <ExternalLink size={13} /> Open Notes
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Mistake category toggle pills ───────────────────────────────────────────

function MistakePills({ selected, onToggle }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-700">Mistake Categories</label>
      <div className="flex flex-wrap gap-2">
        {MISTAKE_CATEGORIES.map((cat) => {
          const active = selected.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggle(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${active
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Per-step validation ──────────────────────────────────────────────────────

function validateStep0(form) {
  const errs = {};
  if (!form.title.trim()) errs.title = 'Problem title is required.';
  if (!form.platform) errs.platform = 'Platform is required.';
  if (!form.difficulty) errs.difficulty = 'Difficulty is required.';
  if (!form.problemUrl.trim()) errs.problemUrl = 'Problem URL is required.';
  else {
    try { new URL(form.problemUrl); } catch { errs.problemUrl = 'Enter a valid URL.'; }
  }
  if (!form.solvingDate) errs.solvingDate = 'Date solved is required.';
  if (!form.status) errs.status = 'Solving status is required.';
  // Optional submissionUrl — validate format only if provided
  if (form.submissionUrl.trim()) {
    try { new URL(form.submissionUrl); } catch { errs.submissionUrl = 'Enter a valid URL or leave blank.'; }
  }
  return errs;
}

function validateStep1(form) {
  const errs = {};
  const driveErr = validateDriveUrl(form.initialApproach.notesUrl);
  if (driveErr) errs.initialNotesUrl = driveErr;
  return errs;
}

function validateStep2(form) {
  const errs = {};
  const driveErr = validateDriveUrl(form.improvedSolution.notesUrl);
  if (driveErr) errs.improvedNotesUrl = driveErr;
  return errs;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AddProblem() {
  const [form, setForm] = useState(makeInitialForm);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [topicSuggestions, setTopicSuggestions] = useState(TOPIC_SUGGESTIONS);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const timeFromQuery = params.get('timeTaken') || location.state?.timeTaken;
    if (timeFromQuery) {
      setForm((f) => ({ ...f, timeTaken: String(timeFromQuery) }));
    }
  }, [location.search, location.state]);

  useEffect(() => {
    problemService.getTopics()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTopicSuggestions(data);
        }
      })
      .catch(() => {});
  }, []);

  // ── State helpers ────────────────────────────────────────────────────────────
  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const setNested = (section, field, value) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
    const key = section + '_' + field;
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const toggleMistake = (cat) => {
    const cur = form.assessment.mistakeCategories;
    setNested('assessment', 'mistakeCategories',
      cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat]);
  };

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = () => {
    let errs = {};
    if (step === 0) errs = validateStep0(form);
    if (step === 1) errs = validateStep1(form);
    if (step === 2) errs = validateStep2(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
  };

  const goBack = () => { setErrors({}); setStep((s) => s - 1); };

  // ── Submission ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Final validation across all steps
    const errs = {
      ...validateStep0(form),
      ...validateStep1(form),
      ...validateStep2(form),
    };
    if (Object.keys(errs).length) { setErrors(errs); setStep(0); return; }

    setSaving(true);
    try {
      await problemService.create(form);
      setSaved(true);
      setTimeout(() => navigate('/library'), 1500);
    } catch {
      setErrors({ submit: 'Failed to save. Your input has been preserved. Please try again.' });
      setSaving(false); // keep saving=false so they can retry without losing form
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-3xl">✓</div>
        <p className="text-lg font-semibold text-gray-900">Problem saved!</p>
        <p className="text-sm text-gray-500">Redirecting to your library…</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Add Problem</h1>
        <p className="text-sm text-gray-500 mt-0.5">Record a new DSA problem in your vault</p>
      </div>

      {/* Step indicator */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
        <StepIndicator current={step} />
      </div>

      {/* ── STEP 0 — Problem Details ─────────────────────────────────────────── */}
      {step === 0 && (
        <FormSection title="A. Problem Details" description="Core information about this problem">
          <FullWidth>
            <Input
              label="Problem Title" required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Two Sum"
              error={errors.title}
              autoFocus
            />
          </FullWidth>

          <Select
            label="Platform" required
            value={form.platform}
            onChange={(e) => set('platform', e.target.value)}
            error={errors.platform}
          >
            <option value="">Select platform</option>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </Select>

          <Select
            label="Difficulty" required
            value={form.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
            error={errors.difficulty}
          >
            <option value="">Select difficulty</option>
            {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
          </Select>

          <FullWidth>
            <Input
              label="Problem URL" required type="url"
              value={form.problemUrl}
              onChange={(e) => set('problemUrl', e.target.value)}
              placeholder="https://leetcode.com/problems/…"
              error={errors.problemUrl}
            />
          </FullWidth>

          <FullWidth>
            <Input
              label="Submission URL" type="url"
              value={form.submissionUrl}
              onChange={(e) => set('submissionUrl', e.target.value)}
              placeholder="https://… (optional)"
              error={errors.submissionUrl}
              hint="Optional — link to your accepted submission"
            />
          </FullWidth>

          <Select
            label="Solving Status" required
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            error={errors.status}
          >
            <option value="">Select status</option>
            {SOLVING_STATUSES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>

          <Input
            label="Date Solved" required type="date"
            value={form.solvingDate}
            onChange={(e) => set('solvingDate', e.target.value)}
            error={errors.solvingDate}
          />

          <Input
            label="Time Taken (minutes)" type="number" min="1" max="600"
            value={form.timeTaken}
            onChange={(e) => set('timeTaken', e.target.value)}
            placeholder="e.g. 30 (optional)"
          />

          <FullWidth>
            <TagInput
              label="Topics"
              tags={form.topics}
              setTags={(t) => set('topics', t)}
              suggestions={topicSuggestions}
              placeholder="Type a topic and press Enter…"
            />
          </FullWidth>
        </FormSection>
      )}

      {/* ── STEP 1 — Initial Approach ─────────────────────────────────────────── */}
      {step === 1 && (
        <FormSection title="B. Initial Approach" description="How you first approached solving this problem">
          <FullWidth>
            <Textarea
              label="Approach Description"
              rows={4}
              value={form.initialApproach.description}
              onChange={(e) => setNested('initialApproach', 'description', e.target.value)}
              placeholder="Describe your initial approach…"
            />
          </FullWidth>

          <Input
            label="Time Complexity"
            value={form.initialApproach.timeComplexity}
            onChange={(e) => setNested('initialApproach', 'timeComplexity', e.target.value)}
            placeholder="e.g. O(n log n)"
          />

          <Input
            label="Space Complexity"
            value={form.initialApproach.spaceComplexity}
            onChange={(e) => setNested('initialApproach', 'spaceComplexity', e.target.value)}
            placeholder="e.g. O(n)"
          />

          <FullWidth>
            <DriveUrlInput
              label="Initial Notes — Google Drive Link"
              value={form.initialApproach.notesUrl}
              onChange={(v) => setNested('initialApproach', 'notesUrl', v)}
              error={errors.initialNotesUrl}
            />
          </FullWidth>

          <FullWidth>
            <Textarea
              label="Mistakes or Difficulties Encountered"
              rows={2}
              value={form.initialApproach.mainDifficulty}
              onChange={(e) => setNested('initialApproach', 'mainDifficulty', e.target.value)}
              placeholder="What tripped you up? Edge cases, algorithm choice, implementation…"
            />
          </FullWidth>
        </FormSection>
      )}

      {/* ── STEP 2 — Improved Solution ────────────────────────────────────────── */}
      {step === 2 && (
        <FormSection
          title="C. Improved Solution"
          description="Better approach after reviewing editorial or discussion (all fields optional)"
        >
          <FullWidth>
            <Checkbox
              label="I reviewed a better solution"
              checked={form.improvedSolution.reviewed}
              onChange={(e) => setNested('improvedSolution', 'reviewed', e.target.checked)}
            />
          </FullWidth>

          {/* Gate improved fields behind the checkbox */}
          {form.improvedSolution.reviewed && (
            <>
              <FullWidth>
                <Textarea
                  label="Improved Approach"
                  rows={4}
                  value={form.improvedSolution.description}
                  onChange={(e) => setNested('improvedSolution', 'description', e.target.value)}
                  placeholder="Describe the optimised approach…"
                />
              </FullWidth>

              <Input
                label="Improved Time Complexity"
                value={form.improvedSolution.timeComplexity}
                onChange={(e) => setNested('improvedSolution', 'timeComplexity', e.target.value)}
                placeholder="e.g. O(n)"
              />

              <Input
                label="Improved Space Complexity"
                value={form.improvedSolution.spaceComplexity}
                onChange={(e) => setNested('improvedSolution', 'spaceComplexity', e.target.value)}
                placeholder="e.g. O(1)"
              />

              <FullWidth>
                <DriveUrlInput
                  label="Improved Notes — Google Drive Link"
                  value={form.improvedSolution.notesUrl}
                  onChange={(v) => setNested('improvedSolution', 'notesUrl', v)}
                  error={errors.improvedNotesUrl}
                />
              </FullWidth>

              <FullWidth>
                <Textarea
                  label="Key Insight Learned"
                  rows={2}
                  value={form.improvedSolution.keyInsight}
                  onChange={(e) => setNested('improvedSolution', 'keyInsight', e.target.value)}
                  placeholder="What's the core idea you'll remember next time?"
                />
              </FullWidth>
            </>
          )}

          {/* When not reviewed, show a gentle reminder that this is optional */}
          {!form.improvedSolution.reviewed && (
            <FullWidth>
              <p className="text-sm text-gray-400 italic">
                Tick the checkbox above if you reviewed an editorial or a better solution.
                You can save without filling this section.
              </p>
            </FullWidth>
          )}
        </FormSection>
      )}

      {/* ── STEP 3 — Self-Assessment ──────────────────────────────────────────── */}
      {step === 3 && (
        <FormSection
          title="D. Self-Assessment"
          description="Honest reflection — used to schedule your next revision"
        >
          <FullWidth>
            <RatingInput
              label="Confidence Rating (1 = barely understood, 5 = totally nailed it)"
              value={form.assessment.confidenceRating}
              onChange={(v) => {
                setNested('assessment', 'confidenceRating', v);
                setNested('assessment', 'nextRevisionDate', computeRevisionDate(v));
              }}
            />
          </FullWidth>

          <FullWidth>
            <Checkbox
              label="I can solve this problem independently without hints"
              checked={form.assessment.canSolveAgain}
              onChange={(e) => setNested('assessment', 'canSolveAgain', e.target.checked)}
            />
          </FullWidth>

          <FullWidth>
            <MistakePills
              selected={form.assessment.mistakeCategories}
              onToggle={toggleMistake}
            />
          </FullWidth>

          <FullWidth>
            <Input
              label="Next Revision Date"
              type="date"
              value={form.assessment.nextRevisionDate}
              onChange={(e) => setNested('assessment', 'nextRevisionDate', e.target.value)}
              hint="Auto-calculated from your confidence rating. Override if you prefer."
            />
          </FullWidth>
        </FormSection>
      )}

      {/* Global submission error (preserved form input) */}
      {errors.submit && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{errors.submit}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pb-6">
        {step > 0
          ? <Button variant="outline" onClick={goBack}>← Back</Button>
          : <div />
        }
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/library')}>Cancel</Button>
          {step < STEPS.length - 1
            ? <Button onClick={goNext}>Next →</Button>
            : <Button onClick={handleSubmit} loading={saving} disabled={saving}>Save Problem</Button>
          }
        </div>
      </div>
    </div>
  );
}
