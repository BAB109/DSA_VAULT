import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { problemService } from '../services/problemService';
import { validateDriveUrl, isValidDriveUrl } from '../utils/driveUrl';
import {
  Input, Textarea, Select, FormSection, FullWidth,
  Checkbox, RatingInput, TagInput, Button,
} from '../components/FormControls';
import { LoadingState, ErrorState } from '../components/States';

const PLATFORMS = ['LeetCode', 'HackerRank', 'CodeForces', 'GFG', 'InterviewBit', 'Other'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const SOLVING_STATUSES = [
  { value: 'Solved Independently', label: 'Solved independently' },
  { value: 'Solved With Hint', label: 'Solved with a hint' },
  { value: 'Solved With Help', label: 'Solved with help' },
  { value: 'Unable To Solve', label: 'Unable to solve' },
];

const MISTAKE_CATEGORIES = [
  'Off-by-one error', 'Wrong algorithm', "Couldn't code it",
  'TLE', 'Wrong complexity analysis', 'Pointer confusion',
  'Forgot base case', 'Edge case missed', 'Other',
];

const TOPIC_SUGGESTIONS = [
  'Array', 'String', 'Hash Map', 'Two Pointers', 'Sliding Window',
  'Stack', 'Queue', 'Linked List', 'Tree', 'BFS', 'DFS',
  'Backtracking', 'Dynamic Programming', 'Greedy', 'Binary Search',
  'Heap', 'Graph', 'Trie', 'Divide & Conquer', 'Union Find',
];

// Normalise a problem loaded from the mock/API to the current field schema
function normalise(p) {
  return {
    ...p,
    status: p.status || 'Solved Independently',
    initialApproach: {
      ...p.initialApproach,
      notesUrl: p.initialApproach.notesUrl ?? p.initialApproach.notesImageUrl ?? '',
      mainDifficulty: p.initialApproach.mainDifficulty || '',
    },
    improvedSolution: {
      ...p.improvedSolution,
      notesUrl: p.improvedSolution.notesUrl ?? p.improvedSolution.notesImageUrl ?? '',
      keyInsight: p.improvedSolution.keyInsight ?? p.improvedSolution.lessonsLearned ?? '',
    },
  };
}

function DriveUrlInput({ label, value, onChange, error }) {
  const valid = isValidDriveUrl(value);
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
          {!error && <p className="mt-1 text-xs text-gray-400">Optional · drive.google.com or docs.google.com only</p>}
        </div>
        {valid && (
          <a
            href={value.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <ExternalLink size={13} /> Open
          </a>
        )}
      </div>
    </div>
  );
}

export default function EditProblem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [topicSuggestions, setTopicSuggestions] = useState(TOPIC_SUGGESTIONS);

  useEffect(() => {
    problemService.getTopics()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTopicSuggestions(data);
        }
      })
      .catch(() => {});

    problemService.getById(id)
      .then((p) => {
        if (!p) { setError('Problem not found.'); return; }
        setForm(normalise(p));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  const handleSave = async () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.platform) errs.platform = 'Platform is required.';
    if (!form.difficulty) errs.difficulty = 'Difficulty is required.';
    if (!form.problemUrl.trim()) errs.problemUrl = 'Problem URL is required.';
    if (!form.solvingDate) errs.solvingDate = 'Date is required.';
    if (!form.status) errs.status = 'Status is required.';
    const iErr = validateDriveUrl(form.initialApproach.notesUrl);
    if (iErr) errs.initialNotesUrl = iErr;
    const mErr = validateDriveUrl(form.improvedSolution.notesUrl);
    if (mErr) errs.improvedNotesUrl = mErr;

    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      await problemService.update(id, form);
      navigate(`/problems/${id}`);
    } catch {
      setErrors({ submit: 'Failed to save. Your changes are preserved. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading problem..." />;
  if (error) return <ErrorState message={error} />;
  if (!form) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Problem</h1>
          <p className="text-sm text-gray-500 mt-0.5">{form.title}</p>
        </div>
      </div>

      {/* A. Problem Details */}
      <FormSection title="A. Problem Details">
        <FullWidth>
          <Input label="Title" required value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} />
        </FullWidth>
        <Select label="Platform" required value={form.platform} onChange={(e) => set('platform', e.target.value)} error={errors.platform}>
          <option value="">Select</option>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </Select>
        <Select label="Difficulty" required value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)} error={errors.difficulty}>
          {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <FullWidth>
          <Input label="Problem URL" required type="url" value={form.problemUrl} onChange={(e) => set('problemUrl', e.target.value)} error={errors.problemUrl} />
        </FullWidth>
        <FullWidth>
          <Input label="Submission URL" type="url" value={form.submissionUrl} onChange={(e) => set('submissionUrl', e.target.value)} hint="Optional" />
        </FullWidth>
        <Select label="Solving Status" required value={form.status} onChange={(e) => set('status', e.target.value)} error={errors.status}>
          <option value="">Select status</option>
          {SOLVING_STATUSES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input label="Date Solved" required type="date" value={form.solvingDate} onChange={(e) => set('solvingDate', e.target.value)} error={errors.solvingDate} />
        <Input label="Time Taken (min)" type="number" min="1" value={form.timeTaken} onChange={(e) => set('timeTaken', e.target.value)} />
        <FullWidth>
          <TagInput label="Topics" tags={form.topics} setTags={(t) => set('topics', t)} suggestions={topicSuggestions} />
        </FullWidth>
      </FormSection>

      {/* B. Initial Approach */}
      <FormSection title="B. Initial Approach">
        <FullWidth>
          <Textarea label="Approach Description" rows={4} value={form.initialApproach.description} onChange={(e) => setNested('initialApproach', 'description', e.target.value)} />
        </FullWidth>
        <Input label="Time Complexity" value={form.initialApproach.timeComplexity} onChange={(e) => setNested('initialApproach', 'timeComplexity', e.target.value)} />
        <Input label="Space Complexity" value={form.initialApproach.spaceComplexity} onChange={(e) => setNested('initialApproach', 'spaceComplexity', e.target.value)} />
        <FullWidth>
          <DriveUrlInput
            label="Initial Notes — Google Drive Link"
            value={form.initialApproach.notesUrl}
            onChange={(v) => setNested('initialApproach', 'notesUrl', v)}
            error={errors.initialNotesUrl}
          />
        </FullWidth>
        <FullWidth>
          <Textarea label="Mistakes / Difficulties" rows={2} value={form.initialApproach.mainDifficulty} onChange={(e) => setNested('initialApproach', 'mainDifficulty', e.target.value)} />
        </FullWidth>
      </FormSection>

      {/* C. Improved Solution */}
      <FormSection title="C. Improved Solution">
        <FullWidth>
          <Checkbox label="Reviewed a better solution" checked={form.improvedSolution.reviewed} onChange={(e) => setNested('improvedSolution', 'reviewed', e.target.checked)} />
        </FullWidth>
        {form.improvedSolution.reviewed && (
          <>
            <FullWidth>
              <Textarea label="Improved Approach" rows={4} value={form.improvedSolution.description} onChange={(e) => setNested('improvedSolution', 'description', e.target.value)} />
            </FullWidth>
            <Input label="Improved Time Complexity" value={form.improvedSolution.timeComplexity} onChange={(e) => setNested('improvedSolution', 'timeComplexity', e.target.value)} />
            <Input label="Improved Space Complexity" value={form.improvedSolution.spaceComplexity} onChange={(e) => setNested('improvedSolution', 'spaceComplexity', e.target.value)} />
            <FullWidth>
              <DriveUrlInput
                label="Improved Notes — Google Drive Link"
                value={form.improvedSolution.notesUrl}
                onChange={(v) => setNested('improvedSolution', 'notesUrl', v)}
                error={errors.improvedNotesUrl}
              />
            </FullWidth>
            <FullWidth>
              <Textarea label="Key Insight Learned" rows={2} value={form.improvedSolution.keyInsight} onChange={(e) => setNested('improvedSolution', 'keyInsight', e.target.value)} />
            </FullWidth>
          </>
        )}
      </FormSection>

      {/* D. Self-Assessment */}
      <FormSection title="D. Self-Assessment">
        <FullWidth>
          <RatingInput label="Confidence Rating (1–5)" value={form.assessment.confidenceRating} onChange={(v) => setNested('assessment', 'confidenceRating', v)} />
        </FullWidth>
        <FullWidth>
          <Checkbox label="Can solve independently without hints" checked={form.assessment.canSolveAgain} onChange={(e) => setNested('assessment', 'canSolveAgain', e.target.checked)} />
        </FullWidth>
        <FullWidth>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-700">Mistake Categories</label>
            <div className="flex flex-wrap gap-2">
              {MISTAKE_CATEGORIES.map((cat) => {
                const active = form.assessment.mistakeCategories.includes(cat);
                return (
                  <button key={cat} type="button" onClick={() => toggleMistake(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                      ${active ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </FullWidth>
        <FullWidth>
          <Input label="Next Revision Date" type="date" value={form.assessment.nextRevisionDate} onChange={(e) => setNested('assessment', 'nextRevisionDate', e.target.value)} />
        </FullWidth>
      </FormSection>

      {errors.submit && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{errors.submit}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pb-6">
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={saving}>Save Changes</Button>
      </div>
    </div>
  );
}
