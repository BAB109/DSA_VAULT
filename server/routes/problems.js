import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../../db/pool.js';
import {
  calculateNextRevision,
  DEFAULT_INTERVALS,
  DEFAULT_PERIODIC_INTERVAL,
  REVISION_OUTCOMES,
} from '../services/scheduler.js';
import { computeUserAnalytics, isSolvedProblem } from '../services/analyticsService.js';

const router = express.Router();

// ------------------------------------------------------------------------------
// In-memory store for problems, problem_topics, revisions, problem_mistakes
// (Seamless persistence fallback if PostgreSQL credentials are not yet configured)
// ------------------------------------------------------------------------------
const memoryProblems = new Map();
const memoryProblemTopics = new Map(); // problem_id -> Set of topic strings
const memoryRevisions = new Map();      // id -> revision object
const memoryMistakes = new Map();       // problem_id -> Set of mistake strings

/**
 * Predefined standard topics list
 */
export const PREDEFINED_TOPICS = [
  'Array', 'String', 'Hash Map', 'Two Pointers', 'Sliding Window',
  'Stack', 'Queue', 'Linked List', 'Tree', 'Binary Search Tree',
  'BFS', 'DFS', 'Backtracking', 'Dynamic Programming', 'Greedy',
  'Binary Search', 'Heap', 'Graph', 'Trie', 'Divide & Conquer',
  'Union Find', 'Segment Tree', 'Bit Manipulation', 'Math',
  'Design', 'Recursion', 'Matrix', 'Sorting', 'Monotonic Stack',
  'Prefix Sum', 'Kadane\'s Algorithm', 'Doubly Linked List'
];

export const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const VALID_STATUSES = [
  'Solved Independently',
  'Solved with Hints',
  'Solved With Hint',
  'Solved With Help',
  'Reviewed Solution',
  'Unsolved',
  'Attempted',
  'Unable To Solve',
];

const ALLOWED_GDRIVE_HOSTS = ['drive.google.com', 'docs.google.com'];

export function validateWebUrl(raw, fieldName, required = true) {
  if (!raw || !raw.trim()) {
    if (required) return `${fieldName} is required.`;
    return null;
  }
  const trimmed = raw.trim();
  const lc = trimmed.toLowerCase();
  if (
    lc.startsWith('javascript:') ||
    lc.startsWith('data:') ||
    lc.startsWith('vbscript:') ||
    lc.startsWith('file:')
  ) {
    return `Unsafe URL scheme in ${fieldName} is not allowed.`;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `${fieldName} must use http or https protocol.`;
    }
  } catch {
    return `${fieldName} must be a valid URL.`;
  }
  return null;
}

export function validateDriveUrl(raw, fieldName) {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const lc = trimmed.toLowerCase();
  if (
    lc.startsWith('javascript:') ||
    lc.startsWith('data:') ||
    lc.startsWith('vbscript:') ||
    lc.startsWith('file:')
  ) {
    return `Unsafe URL scheme in ${fieldName} is not allowed.`;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return `${fieldName} must use https protocol.`;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!ALLOWED_GDRIVE_HOSTS.includes(host)) {
      return `${fieldName} must be a valid Google Drive link (drive.google.com or docs.google.com).`;
    }
  } catch {
    return `${fieldName} must be a valid Google Drive link.`;
  }
  return null;
}

/**
 * Helper to transform DB row or memory object to frontend format
 */
function formatProblem(p, topics = [], mistakes = [], revisions = []) {
  return {
    id: p.id,
    title: p.title,
    platform: p.platform,
    problemUrl: p.problem_url || p.problemUrl,
    submissionUrl: p.submission_url || p.submissionUrl || '',
    difficulty: p.difficulty,
    topics: topics,
    solvingDate: p.solved_at ? (typeof p.solved_at === 'string' ? p.solved_at.split('T')[0] : p.solved_at.toISOString().split('T')[0]) : p.solvingDate,
    timeTaken: p.time_taken_minutes != null ? p.time_taken_minutes : (p.timeTaken || ''),
    status: p.solving_status || p.status,
    initialApproach: {
      description: p.initial_approach ?? (p.initialApproach?.description || ''),
      timeComplexity: p.initial_time_complexity ?? (p.initialApproach?.timeComplexity || ''),
      spaceComplexity: p.initial_space_complexity ?? (p.initialApproach?.spaceComplexity || ''),
      notesUrl: p.initial_notes_url ?? (p.initialApproach?.notesUrl || ''),
      mainDifficulty: p.main_difficulty ?? (p.initialApproach?.mainDifficulty || ''),
    },
    improvedSolution: {
      reviewed: Boolean(p.reviewed_better_solution ?? p.improvedSolution?.reviewed ?? false),
      description: p.improved_approach ?? (p.improvedSolution?.description || ''),
      timeComplexity: p.improved_time_complexity ?? (p.improvedSolution?.timeComplexity || ''),
      spaceComplexity: p.improved_space_complexity ?? (p.improvedSolution?.spaceComplexity || ''),
      notesUrl: p.improved_notes_url ?? (p.improvedSolution?.notesUrl || ''),
      keyInsight: p.key_insight ?? (p.improvedSolution?.keyInsight || ''),
    },
    assessment: {
      confidenceRating: p.confidence_level ?? (p.assessment?.confidenceRating || 3),
      canSolveAgain: Boolean(p.can_solve_independently ?? p.assessment?.canSolveAgain ?? true),
      mistakeCategories: mistakes,
      nextRevisionDate: p.next_revision_at ? (typeof p.next_revision_at === 'string' ? p.next_revision_at.split('T')[0] : p.next_revision_at.toISOString().split('T')[0]) : (p.assessment?.nextRevisionDate || ''),
    },
    revisionHistory: revisions,
    createdAt: p.created_at ? (typeof p.created_at === 'string' ? p.created_at : p.created_at.toISOString()) : new Date().toISOString(),
  };
}

// ------------------------------------------------------------------------------
// GET /api/topics - Return all DSA topics
// ------------------------------------------------------------------------------
router.get('/topics', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM topics ORDER BY name ASC');
    return res.json(rows.map(r => r.name));
  } catch (err) {
    // Return predefined list if DB unconfigured
    return res.json(PREDEFINED_TOPICS);
  }
});

// ------------------------------------------------------------------------------
// GET /api/problems - List problems with server-side search, filters, sort & pagination
// ------------------------------------------------------------------------------
router.get('/problems', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    search,
    difficulty,
    platform,
    status,
    topic,
    reviewed,
    revision,
    sort = 'newest',
    page,
    limit,
  } = req.query;

  const todayStr = new Date().toISOString().split('T')[0];
  const pageNum = page ? Math.max(1, parseInt(page, 10)) : null;
  const limitNum = limit ? Math.max(1, parseInt(limit, 10)) : null;

  try {
    let whereClauses = ['p.user_id = $1'];
    const params = [userId];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClauses.push(`(p.title ILIKE $${params.length} OR p.platform ILIKE $${params.length})`);
    }
    if (difficulty) {
      params.push(difficulty);
      whereClauses.push(`p.difficulty = $${params.length}`);
    }
    if (platform) {
      params.push(platform);
      whereClauses.push(`p.platform = $${params.length}`);
    }
    if (status) {
      params.push(status);
      whereClauses.push(`p.solving_status = $${params.length}`);
    }
    if (reviewed !== undefined && reviewed !== '') {
      params.push(reviewed === 'true' || reviewed === true);
      whereClauses.push(`p.reviewed_better_solution = $${params.length}`);
    }
    if (revision === 'due') {
      params.push(todayStr);
      whereClauses.push(`p.next_revision_at IS NOT NULL AND p.next_revision_at <= $${params.length}`);
    } else if (revision === 'overdue') {
      params.push(todayStr);
      whereClauses.push(`p.next_revision_at IS NOT NULL AND p.next_revision_at < $${params.length}`);
    } else if (revision === 'upcoming') {
      params.push(todayStr);
      whereClauses.push(`p.next_revision_at IS NOT NULL AND p.next_revision_at > $${params.length}`);
    }
    if (topic) {
      params.push(topic);
      whereClauses.push(`EXISTS (
        SELECT 1 FROM problem_topics pt
        JOIN topics t ON pt.topic_id = t.id
        WHERE pt.problem_id = p.id AND t.name = $${params.length}
      )`);
    }

    const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Determine sort expression
    let orderBy = 'p.solved_at DESC, p.created_at DESC';
    if (sort === 'oldest') {
      orderBy = 'p.solved_at ASC, p.created_at ASC';
    } else if (sort === 'title_asc' || sort === 'title') {
      orderBy = 'p.title ASC';
    } else if (sort === 'difficulty') {
      orderBy = `CASE p.difficulty WHEN 'Easy' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Hard' THEN 3 ELSE 4 END ASC, p.solved_at DESC`;
    }

    let queryText = `
      SELECT p.*,
        COALESCE(
          (SELECT json_agg(t.name ORDER BY t.name)
           FROM problem_topics pt
           JOIN topics t ON pt.topic_id = t.id
           WHERE pt.problem_id = p.id), '[]'::json
        ) as topic_list,
        COALESCE(
          (SELECT json_agg(pm.mistake_category ORDER BY pm.mistake_category)
           FROM problem_mistakes pm
           WHERE pm.problem_id = p.id), '[]'::json
        ) as mistake_list,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', r.id,
              'date', to_char(r.scheduled_at, 'YYYY-MM-DD'),
              'result', r.result,
              'notes', r.notes
            ) ORDER BY r.scheduled_at DESC
          )
           FROM revisions r
           WHERE r.problem_id = p.id AND r.completed_at IS NOT NULL), '[]'::json
        ) as revision_list
      FROM problems p
      ${whereStr}
      ORDER BY ${orderBy}
    `;

    // Count total for pagination
    const countRes = await pool.query(`SELECT COUNT(*) FROM problems p ${whereStr}`, params);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    if (pageNum && limitNum) {
      const offset = (pageNum - 1) * limitNum;
      params.push(limitNum, offset);
      queryText += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const { rows } = await pool.query(queryText, params);
    const results = rows.map(r => formatProblem(r, r.topic_list, r.mistake_list, r.revision_list));

    if (pageNum && limitNum) {
      return res.json({
        data: results,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    }

    return res.json(results);
  } catch (err) {
    // In-memory fallback
    const userProblems = Array.from(memoryProblems.values())
      .filter(p => p.userId === userId);

    let results = userProblems.map(p => {
      const topics = Array.from(memoryProblemTopics.get(p.id) || []);
      const mistakes = Array.from(memoryMistakes.get(p.id) || []);
      const revs = Array.from(memoryRevisions.values()).filter(r => r.problemId === p.id);
      return formatProblem(p, topics, mistakes, revs);
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(p => p.title.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q));
    }
    if (difficulty) {
      results = results.filter(p => p.difficulty === difficulty);
    }
    if (platform) {
      results = results.filter(p => p.platform === platform);
    }
    if (status) {
      results = results.filter(p => p.status === status);
    }
    if (topic) {
      results = results.filter(p => p.topics.includes(topic));
    }
    if (reviewed !== undefined && reviewed !== '') {
      const isRev = reviewed === 'true' || reviewed === true;
      results = results.filter(p => Boolean(p.improvedSolution?.reviewed) === isRev);
    }
    if (revision === 'due') {
      results = results.filter(p => p.assessment?.nextRevisionDate && p.assessment.nextRevisionDate <= todayStr);
    } else if (revision === 'overdue') {
      results = results.filter(p => p.assessment?.nextRevisionDate && p.assessment.nextRevisionDate < todayStr);
    } else if (revision === 'upcoming') {
      results = results.filter(p => p.assessment?.nextRevisionDate && p.assessment.nextRevisionDate > todayStr);
    }

    // Sort
    if (sort === 'oldest') {
      results.sort((a, b) => new Date(a.solvingDate) - new Date(b.solvingDate));
    } else if (sort === 'title_asc' || sort === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'difficulty') {
      const orderMap = { Easy: 1, Medium: 2, Hard: 3 };
      results.sort((a, b) => (orderMap[a.difficulty] || 4) - (orderMap[b.difficulty] || 4));
    } else {
      results.sort((a, b) => new Date(b.solvingDate || b.createdAt) - new Date(a.solvingDate || a.createdAt));
    }

    const totalCount = results.length;

    if (pageNum && limitNum) {
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedData = results.slice(startIndex, startIndex + limitNum);
      return res.json({
        data: paginatedData,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    }

    return res.json(results);
  }
});

// ------------------------------------------------------------------------------
// GET /api/problems/:id - Get complete single problem for authenticated user
// ------------------------------------------------------------------------------
router.get('/problems/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const problemId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT p.*,
        COALESCE(
          (SELECT json_agg(t.name ORDER BY t.name)
           FROM problem_topics pt
           JOIN topics t ON pt.topic_id = t.id
           WHERE pt.problem_id = p.id), '[]'::json
        ) as topic_list,
        COALESCE(
          (SELECT json_agg(pm.mistake_category ORDER BY pm.mistake_category)
           FROM problem_mistakes pm
           WHERE pm.problem_id = p.id), '[]'::json
        ) as mistake_list,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', r.id,
              'date', to_char(r.scheduled_at, 'YYYY-MM-DD'),
              'result', r.result,
              'notes', r.notes
            ) ORDER BY r.scheduled_at DESC
          )
           FROM revisions r
           WHERE r.problem_id = p.id AND r.completed_at IS NOT NULL), '[]'::json
        ) as revision_list
      FROM problems p
      WHERE p.id = $1 AND p.user_id = $2`,
      [problemId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found.' });
    }

    const r = rows[0];
    return res.json(formatProblem(r, r.topic_list, r.mistake_list, r.revision_list));
  } catch (err) {
    const p = memoryProblems.get(problemId);
    if (!p || p.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found.' });
    }

    const topics = Array.from(memoryProblemTopics.get(p.id) || []);
    const mistakes = Array.from(memoryMistakes.get(p.id) || []);
    const revs = Array.from(memoryRevisions.values()).filter(r => r.problemId === p.id);
    return res.json(formatProblem(p, topics, mistakes, revs));
  }
});

// ------------------------------------------------------------------------------
// POST /api/problems - Create a new problem for authenticated user
// ------------------------------------------------------------------------------
router.post('/problems', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const body = req.body;

  // Basic required validations
  if (!body.title || !body.title.trim()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Problem title is required.' });
  }
  if (!body.platform) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Platform is required.' });
  }
  if (!body.difficulty) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Difficulty is required.' });
  }
  if (!VALID_DIFFICULTIES.includes(body.difficulty)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Difficulty must be Easy, Medium, or Hard.' });
  }
  if (!body.problemUrl || !body.problemUrl.trim()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Problem URL is required.' });
  }
  const problemUrlErr = validateWebUrl(body.problemUrl, 'Problem URL', true);
  if (problemUrlErr) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: problemUrlErr });
  }
  if (body.submissionUrl) {
    const subUrlErr = validateWebUrl(body.submissionUrl, 'Submission URL', false);
    if (subUrlErr) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: subUrlErr });
    }
  }
  if (!body.status) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Solving status is required.' });
  }
  if (!VALID_STATUSES.includes(body.status)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid solving status.' });
  }
  if (!body.solvingDate) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Solving date is required.' });
  }
  if (body.timeTaken != null && body.timeTaken !== '') {
    const parsedTime = parseInt(body.timeTaken, 10);
    if (isNaN(parsedTime) || parsedTime < 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Time taken must be a positive number.' });
    }
  }

  const initial = body.initialApproach || {};
  const improved = body.improvedSolution || {};

  if (initial.notesUrl) {
    const initNotesErr = validateDriveUrl(initial.notesUrl, 'Initial notes URL');
    if (initNotesErr) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: initNotesErr });
    }
  }
  const impNotes = improved.notesUrl || body.improvedNotesUrl;
  if (impNotes) {
    const impNotesErr = validateDriveUrl(impNotes, 'Improved notes URL');
    if (impNotesErr) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: impNotesErr });
    }
  }
  const assessment = body.assessment || {};
  const topics = Array.isArray(body.topics) ? body.topics : [];
  const mistakes = Array.isArray(assessment.mistakeCategories)
    ? assessment.mistakeCategories
    : (Array.isArray(body.mistakeCategories) ? body.mistakeCategories : []);

  const isReviewedBetter = Boolean(
    improved.reviewed ?? body.reviewedBetterSolution ?? body.reviewed_better_solution ?? false
  );
  const canSolveIndependently = assessment.canSolveAgain != null
    ? Boolean(assessment.canSolveAgain)
    : (body.canSolveAgain != null
      ? Boolean(body.canSolveAgain)
      : (body.can_solve_independently != null
        ? Boolean(body.can_solve_independently)
        : (body.status === 'Solved Independently')));
  const nextRevDate = assessment.nextRevisionDate || body.nextRevisionDate || body.next_revision_at || null;
  const confLevel = assessment.confidenceRating
    ? parseInt(assessment.confidenceRating, 10)
    : (body.confidenceRating || body.confidence_level || 3);

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertProblemSql = `
        INSERT INTO problems (
          user_id, title, platform, problem_url, submission_url, difficulty,
          solving_status, time_taken_minutes, solved_at,
          initial_approach, initial_time_complexity, initial_space_complexity,
          initial_notes_url, main_difficulty,
          reviewed_better_solution, improved_approach, improved_time_complexity,
          improved_space_complexity, improved_notes_url, key_insight,
          confidence_level, can_solve_independently, next_revision_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14,
          $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23
        ) RETURNING *;
      `;

      const values = [
        userId,
        body.title.trim(),
        body.platform,
        body.problemUrl.trim(),
        body.submissionUrl ? body.submissionUrl.trim() : null,
        body.difficulty,
        body.status,
        body.timeTaken ? parseInt(body.timeTaken, 10) : null,
        body.solvingDate,
        initial.description || null,
        initial.timeComplexity || null,
        initial.spaceComplexity || null,
        initial.notesUrl ? initial.notesUrl.trim() : null,
        initial.mainDifficulty || null,
        isReviewedBetter,
        isReviewedBetter ? (improved.description || body.improvedApproach || null) : null,
        isReviewedBetter ? (improved.timeComplexity || body.improvedTimeComplexity || null) : null,
        isReviewedBetter ? (improved.spaceComplexity || body.improvedSpaceComplexity || null) : null,
        isReviewedBetter && (improved.notesUrl || body.improvedNotesUrl) ? (improved.notesUrl || body.improvedNotesUrl).trim() : null,
        isReviewedBetter ? (improved.keyInsight || body.keyInsight || null) : null,
        confLevel,
        canSolveIndependently,
        nextRevDate,
      ];

      const { rows } = await client.query(insertProblemSql, values);
      const newProblem = rows[0];

      // Handle topics
      for (const tName of topics) {
        if (!tName || !tName.trim()) continue;
        const topicRes = await client.query(
          `INSERT INTO topics (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [tName.trim()]
        );
        const topicId = topicRes.rows[0].id;
        await client.query(
          `INSERT INTO problem_topics (problem_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newProblem.id, topicId]
        );
      }

      // Handle mistakes
      for (const mCat of mistakes) {
        if (!mCat) continue;
        await client.query(
          `INSERT INTO problem_mistakes (problem_id, mistake_category) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [newProblem.id, mCat]
        );
      }

      await client.query('COMMIT');

      return res.status(201).json(formatProblem(newProblem, topics, mistakes, []));
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    // Development fallback
    const id = `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRecord = {
      id,
      userId,
      title: body.title.trim(),
      platform: body.platform,
      problemUrl: body.problemUrl.trim(),
      submissionUrl: body.submissionUrl ? body.submissionUrl.trim() : '',
      difficulty: body.difficulty,
      status: body.status,
      timeTaken: body.timeTaken ? parseInt(body.timeTaken, 10) : null,
      solvingDate: body.solvingDate,
      reviewed_better_solution: isReviewedBetter,
      can_solve_independently: canSolveIndependently,
      next_revision_at: nextRevDate,
      confidence_level: confLevel,
      initialApproach: {
        description: initial.description || '',
        timeComplexity: initial.timeComplexity || '',
        spaceComplexity: initial.spaceComplexity || '',
        notesUrl: initial.notesUrl ? initial.notesUrl.trim() : '',
        mainDifficulty: initial.mainDifficulty || '',
      },
      improvedSolution: {
        reviewed: isReviewedBetter,
        description: isReviewedBetter ? (improved.description || body.improvedApproach || '') : '',
        timeComplexity: isReviewedBetter ? (improved.timeComplexity || body.improvedTimeComplexity || '') : '',
        spaceComplexity: isReviewedBetter ? (improved.spaceComplexity || body.improvedSpaceComplexity || '') : '',
        notesUrl: isReviewedBetter && (improved.notesUrl || body.improvedNotesUrl) ? (improved.notesUrl || body.improvedNotesUrl).trim() : '',
        keyInsight: isReviewedBetter ? (improved.keyInsight || body.keyInsight || '') : '',
      },
      assessment: {
        confidenceRating: confLevel,
        canSolveAgain: canSolveIndependently,
        mistakeCategories: mistakes,
        nextRevisionDate: nextRevDate || '',
      },
      createdAt: new Date().toISOString(),
    };

    memoryProblems.set(id, newRecord);
    memoryProblemTopics.set(id, new Set(topics));
    memoryMistakes.set(id, new Set(mistakes));

    return res.status(201).json(formatProblem(newRecord, topics, mistakes, []));
  }
});

// ------------------------------------------------------------------------------
// PUT /api/problems/:id - Update an existing problem (Isolated by user_id)
// ------------------------------------------------------------------------------
router.put('/problems/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const problemId = req.params.id;
  const body = req.body;

  const initial = body.initialApproach || {};
  const improved = body.improvedSolution || {};
  const assessment = body.assessment || {};
  const topics = Array.isArray(body.topics) ? body.topics : [];
  const mistakes = Array.isArray(assessment.mistakeCategories) ? assessment.mistakeCategories : [];

  if (body.difficulty && !VALID_DIFFICULTIES.includes(body.difficulty)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Difficulty must be Easy, Medium, or Hard.' });
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid solving status.' });
  }
  if (body.problemUrl) {
    const pErr = validateWebUrl(body.problemUrl, 'Problem URL', true);
    if (pErr) return res.status(400).json({ error: 'VALIDATION_ERROR', message: pErr });
  }
  if (body.submissionUrl) {
    const sErr = validateWebUrl(body.submissionUrl, 'Submission URL', false);
    if (sErr) return res.status(400).json({ error: 'VALIDATION_ERROR', message: sErr });
  }
  if (initial.notesUrl) {
    const initNotesErr = validateDriveUrl(initial.notesUrl, 'Initial notes URL');
    if (initNotesErr) return res.status(400).json({ error: 'VALIDATION_ERROR', message: initNotesErr });
  }
  const impNotes = improved.notesUrl || body.improvedNotesUrl;
  if (impNotes) {
    const impNotesErr = validateDriveUrl(impNotes, 'Improved notes URL');
    if (impNotesErr) return res.status(400).json({ error: 'VALIDATION_ERROR', message: impNotesErr });
  }
  if (body.timeTaken != null && body.timeTaken !== '') {
    const parsedTime = parseInt(body.timeTaken, 10);
    if (isNaN(parsedTime) || parsedTime < 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Time taken must be a positive number.' });
    }
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateSql = `
        UPDATE problems SET
          title = COALESCE($1, title),
          platform = COALESCE($2, platform),
          problem_url = COALESCE($3, problem_url),
          submission_url = $4,
          difficulty = COALESCE($5, difficulty),
          solving_status = COALESCE($6, solving_status),
          time_taken_minutes = $7,
          solved_at = COALESCE($8, solved_at),
          initial_approach = $9,
          initial_time_complexity = $10,
          initial_space_complexity = $11,
          initial_notes_url = $12,
          main_difficulty = $13,
          reviewed_better_solution = $14,
          improved_approach = $15,
          improved_time_complexity = $16,
          improved_space_complexity = $17,
          improved_notes_url = $18,
          key_insight = $19,
          confidence_level = $20,
          can_solve_independently = $21,
          next_revision_at = $22,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $23 AND user_id = $24
        RETURNING *;
      `;

      const values = [
        body.title ? body.title.trim() : null,
        body.platform || null,
        body.problemUrl ? body.problemUrl.trim() : null,
        body.submissionUrl ? body.submissionUrl.trim() : null,
        body.difficulty || null,
        body.status || null,
        body.timeTaken ? parseInt(body.timeTaken, 10) : null,
        body.solvingDate || null,
        initial.description || null,
        initial.timeComplexity || null,
        initial.spaceComplexity || null,
        initial.notesUrl ? initial.notesUrl.trim() : null,
        initial.mainDifficulty || null,
        Boolean(improved.reviewed),
        improved.reviewed ? (improved.description || null) : null,
        improved.reviewed ? (improved.timeComplexity || null) : null,
        improved.reviewed ? (improved.spaceComplexity || null) : null,
        improved.reviewed && improved.notesUrl ? improved.notesUrl.trim() : null,
        improved.reviewed ? (improved.keyInsight || null) : null,
        assessment.confidenceRating ? parseInt(assessment.confidenceRating, 10) : null,
        assessment.canSolveAgain != null ? Boolean(assessment.canSolveAgain) : null,
        assessment.nextRevisionDate || null,
        problemId,
        userId,
      ];

      const { rows } = await client.query(updateSql, values);
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found or not authorized.' });
      }

      // Refresh topics
      await client.query('DELETE FROM problem_topics WHERE problem_id = $1', [problemId]);
      for (const tName of topics) {
        if (!tName || !tName.trim()) continue;
        const topicRes = await client.query(
          `INSERT INTO topics (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [tName.trim()]
        );
        const topicId = topicRes.rows[0].id;
        await client.query(
          `INSERT INTO problem_topics (problem_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [problemId, topicId]
        );
      }

      // Refresh mistakes
      await client.query('DELETE FROM problem_mistakes WHERE problem_id = $1', [problemId]);
      for (const mCat of mistakes) {
        if (!mCat) continue;
        await client.query(
          `INSERT INTO problem_mistakes (problem_id, mistake_category) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [problemId, mCat]
        );
      }

      await client.query('COMMIT');
      return res.json(formatProblem(rows[0], topics, mistakes, []));
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    const existing = memoryProblems.get(problemId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found or not authorized.' });
    }

    const isRevBetter = improved.reviewed != null
      ? Boolean(improved.reviewed)
      : (body.reviewedBetterSolution != null ? Boolean(body.reviewedBetterSolution) : existing.reviewed_better_solution);
    const canInd = assessment.canSolveAgain != null
      ? Boolean(assessment.canSolveAgain)
      : (body.canSolveAgain != null ? Boolean(body.canSolveAgain) : existing.can_solve_independently);
    const nextRev = assessment.nextRevisionDate || body.nextRevisionDate || existing.next_revision_at;

    const updated = {
      ...existing,
      ...body,
      reviewed_better_solution: isRevBetter,
      can_solve_independently: canInd,
      next_revision_at: nextRev,
      initialApproach: { ...existing.initialApproach, ...initial },
      improvedSolution: { ...existing.improvedSolution, ...improved, reviewed: isRevBetter },
      assessment: { ...existing.assessment, ...assessment, canSolveAgain: canInd, nextRevisionDate: nextRev },
    };

    memoryProblems.set(problemId, updated);
    memoryProblemTopics.set(problemId, new Set(topics));
    memoryMistakes.set(problemId, new Set(mistakes));

    const revs = Array.from(memoryRevisions.values()).filter(r => r.problemId === problemId);
    return res.json(formatProblem(updated, topics, mistakes, revs));
  }
});

// ------------------------------------------------------------------------------
// DELETE /api/problems/:id - Delete problem (Strictly isolated by user_id)
// ------------------------------------------------------------------------------
router.delete('/problems/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const problemId = req.params.id;

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM problems WHERE id = $1 AND user_id = $2`,
      [problemId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found or not authorized.' });
    }

    return res.json({ success: true, message: 'Problem deleted successfully.' });
  } catch (err) {
    const existing = memoryProblems.get(problemId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found or not authorized.' });
    }

    memoryProblems.delete(problemId);
    memoryProblemTopics.delete(problemId);
    memoryMistakes.delete(problemId);
    return res.json({ success: true, message: 'Problem deleted successfully.' });
  }
});

// ------------------------------------------------------------------------------
// In-memory store for user settings
// ------------------------------------------------------------------------------
const memoryUserSettings = new Map();

/**
 * Helper to fetch a user's configured revision intervals
 */
async function getUserIntervals(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT interval_stage_1, interval_stage_2, interval_stage_3, interval_stage_4, interval_stage_5, periodic_interval
       FROM user_settings WHERE user_id = $1`,
      [userId]
    );
    if (rows.length > 0) {
      const r = rows[0];
      return {
        intervals: [r.interval_stage_1, r.interval_stage_2, r.interval_stage_3, r.interval_stage_4, r.interval_stage_5],
        periodicInterval: r.periodic_interval,
      };
    }
  } catch {}

  const mem = memoryUserSettings.get(userId);
  if (mem) {
    return {
      intervals: [
        mem.interval_stage_1 ?? 1,
        mem.interval_stage_2 ?? 3,
        mem.interval_stage_3 ?? 7,
        mem.interval_stage_4 ?? 14,
        mem.interval_stage_5 ?? 30,
      ],
      periodicInterval: mem.periodic_interval ?? 30,
    };
  }

  return {
    intervals: DEFAULT_INTERVALS,
    periodicInterval: DEFAULT_PERIODIC_INTERVAL,
  };
}

// ------------------------------------------------------------------------------
// GET /api/settings - Get user settings including revision intervals
// ------------------------------------------------------------------------------
router.get('/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_settings WHERE user_id = $1`,
      [userId]
    );

    if (rows.length > 0) {
      const r = rows[0];
      return res.json({
        intervals: [r.interval_stage_1, r.interval_stage_2, r.interval_stage_3, r.interval_stage_4, r.interval_stage_5],
        periodicInterval: r.periodic_interval,
        dailyProblemGoal: r.daily_problem_goal ?? 3,
        dailyRevisionGoal: r.daily_revision_goal ?? 2,
        dailyGoal: r.daily_problem_goal ?? 3,
        weeklyGoal: r.weekly_problem_goal ?? 15,
        timezone: r.timezone || 'UTC',
      });
    }
  } catch {}

  const mem = memoryUserSettings.get(userId);
  if (mem) {
    return res.json({
      intervals: [mem.interval_stage_1, mem.interval_stage_2, mem.interval_stage_3, mem.interval_stage_4, mem.interval_stage_5],
      periodicInterval: mem.periodic_interval,
      dailyProblemGoal: mem.daily_problem_goal ?? 3,
      dailyRevisionGoal: mem.daily_revision_goal ?? 2,
      dailyGoal: mem.daily_problem_goal ?? 3,
      weeklyGoal: mem.weekly_problem_goal ?? 15,
      timezone: mem.timezone || 'UTC',
    });
  }

  return res.json({
    intervals: DEFAULT_INTERVALS,
    periodicInterval: DEFAULT_PERIODIC_INTERVAL,
    dailyProblemGoal: 3,
    dailyRevisionGoal: 2,
    dailyGoal: 3,
    weeklyGoal: 15,
    timezone: 'UTC',
  });
});

// ------------------------------------------------------------------------------
// PUT /api/settings - Update user settings and revision intervals
// ------------------------------------------------------------------------------
router.put('/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { intervals, periodicInterval, dailyGoal, dailyProblemGoal, dailyRevisionGoal, weeklyGoal, timezone } = req.body;

  const rawProbGoal = dailyProblemGoal != null ? dailyProblemGoal : dailyGoal;
  const rawRevGoal = dailyRevisionGoal;

  if (rawProbGoal !== undefined && (isNaN(rawProbGoal) || parseInt(rawProbGoal, 10) < 1 || parseInt(rawProbGoal, 10) > 50)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Daily problem goal must be an integer between 1 and 50.' });
  }

  if (rawRevGoal !== undefined && (isNaN(rawRevGoal) || parseInt(rawRevGoal, 10) < 1 || parseInt(rawRevGoal, 10) > 50)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Daily revision goal must be an integer between 1 and 50.' });
  }

  const st1 = intervals?.[0] ? Math.max(1, parseInt(intervals[0], 10)) : 1;
  const st2 = intervals?.[1] ? Math.max(1, parseInt(intervals[1], 10)) : 3;
  const st3 = intervals?.[2] ? Math.max(1, parseInt(intervals[2], 10)) : 7;
  const st4 = intervals?.[3] ? Math.max(1, parseInt(intervals[3], 10)) : 14;
  const st5 = intervals?.[4] ? Math.max(1, parseInt(intervals[4], 10)) : 30;
  const periodic = periodicInterval ? Math.max(1, parseInt(periodicInterval, 10)) : 30;
  const dailyProblems = rawProbGoal != null ? Math.max(1, Math.min(50, parseInt(rawProbGoal, 10))) : 3;
  const dailyRevisions = rawRevGoal != null ? Math.max(1, Math.min(50, parseInt(rawRevGoal, 10))) : 2;
  const weekly = weeklyGoal ? Math.max(1, Math.min(200, parseInt(weeklyGoal, 10))) : 15;
  const tz = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC';

  try {
    await pool.query(
      `INSERT INTO user_settings (
        user_id, interval_stage_1, interval_stage_2, interval_stage_3, interval_stage_4, interval_stage_5, periodic_interval, daily_problem_goal, daily_revision_goal, weekly_problem_goal, timezone, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        interval_stage_1 = EXCLUDED.interval_stage_1,
        interval_stage_2 = EXCLUDED.interval_stage_2,
        interval_stage_3 = EXCLUDED.interval_stage_3,
        interval_stage_4 = EXCLUDED.interval_stage_4,
        interval_stage_5 = EXCLUDED.interval_stage_5,
        periodic_interval = EXCLUDED.periodic_interval,
        daily_problem_goal = EXCLUDED.daily_problem_goal,
        daily_revision_goal = EXCLUDED.daily_revision_goal,
        weekly_problem_goal = EXCLUDED.weekly_problem_goal,
        timezone = EXCLUDED.timezone,
        updated_at = CURRENT_TIMESTAMP`,
      [userId, st1, st2, st3, st4, st5, periodic, dailyProblems, dailyRevisions, weekly, tz]
    );
  } catch (err) {
    memoryUserSettings.set(userId, {
      interval_stage_1: st1,
      interval_stage_2: st2,
      interval_stage_3: st3,
      interval_stage_4: st4,
      interval_stage_5: st5,
      periodic_interval: periodic,
      daily_problem_goal: dailyProblems,
      daily_revision_goal: dailyRevisions,
      weekly_problem_goal: weekly,
      timezone: tz,
    });
  }

  return res.json({
    intervals: [st1, st2, st3, st4, st5],
    periodicInterval: periodic,
    dailyProblemGoal: dailyProblems,
    dailyRevisionGoal: dailyRevisions,
    dailyGoal: dailyProblems,
    weeklyGoal: weekly,
    timezone: tz,
  });
});

// ------------------------------------------------------------------------------
// POST /api/problems/:id/revisions - Record a revision attempt & schedule next
// ------------------------------------------------------------------------------
router.post('/problems/:id/revisions', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const problemId = req.params.id;
  const { date, result, notes } = req.body;

  if (!result || typeof result !== 'string') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Revision outcome is required.' });
  }

  // Normalise outcome string
  let canonicalResult = result;
  if (result === 'Remembered') canonicalResult = 'Solved Independently';
  if (result === 'Partially Remembered') canonicalResult = 'Solved With Hint';
  if (result === 'Forgot') canonicalResult = 'Unable To Solve';

  const userConfig = await getUserIntervals(userId);

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify problem belongs to user
      const probRes = await client.query(
        'SELECT id, confidence_level, next_revision_at FROM problems WHERE id = $1 AND user_id = $2',
        [problemId, userId]
      );
      if (probRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found.' });
      }

      const p = probRes.rows[0];
      const curStage = p.confidence_level || 1;

      // Calculate next revision schedule using engine
      const schedule = calculateNextRevision({
        outcome: canonicalResult,
        currentStage: curStage,
        configuredIntervals: userConfig.intervals,
        periodicInterval: userConfig.periodicInterval,
        baseDate: date || new Date(),
      });

      // Insert revision entry
      const revRes = await client.query(
        `INSERT INTO revisions (problem_id, scheduled_at, completed_at, result, notes, next_revision_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)
         RETURNING *`,
        [problemId, date || new Date().toISOString().split('T')[0], canonicalResult, notes || null, schedule.nextDate]
      );

      // Update problem confidence stage & next revision date
      await client.query(
        `UPDATE problems SET confidence_level = $1, next_revision_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [schedule.nextStage, schedule.nextDate, problemId]
      );

      await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        revision: {
          id: revRes.rows[0].id,
          date: toDateString(revRes.rows[0].scheduled_at),
          result: revRes.rows[0].result,
          notes: revRes.rows[0].notes,
        },
        nextRevisionDate: schedule.nextDate,
        stage: schedule.nextStage,
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    const existing = memoryProblems.get(problemId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found.' });
    }

    const curStage = existing.assessment?.confidenceRating || 1;
    const schedule = calculateNextRevision({
      outcome: canonicalResult,
      currentStage: curStage,
      configuredIntervals: userConfig.intervals,
      periodicInterval: userConfig.periodicInterval,
      baseDate: date || new Date(),
    });

    const revId = `rev_${Date.now()}`;
    const revObj = {
      id: revId,
      problemId,
      date: date || new Date().toISOString().split('T')[0],
      result: canonicalResult,
      notes: notes || '',
    };
    memoryRevisions.set(revId, revObj);

    existing.next_revision_at = schedule.nextDate;
    existing.assessment = {
      ...existing.assessment,
      confidenceRating: schedule.nextStage,
      nextRevisionDate: schedule.nextDate,
    };

    return res.status(201).json({
      success: true,
      revision: revObj,
      nextRevisionDate: schedule.nextDate,
      stage: schedule.nextStage,
    });
  }
});

// Helper for clean date formatting
function toDateString(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.split('T')[0];
  return d.toISOString().split('T')[0];
}

// ------------------------------------------------------------------------------
// POST /api/problems/:id/reschedule - Manually reschedule next revision date
// ------------------------------------------------------------------------------
router.post('/problems/:id/reschedule', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const problemId = req.params.id;
  const { nextRevisionDate } = req.body;

  if (!nextRevisionDate || !/^\d{4}-\d{2}-\d{2}$/.test(nextRevisionDate)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Valid date in YYYY-MM-DD format required.' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE problems SET next_revision_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [nextRevisionDate, problemId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found or unauthorized.' });
    }

    return res.json({ success: true, nextRevisionDate });
  } catch (err) {
    const existing = memoryProblems.get(problemId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Problem not found or unauthorized.' });
    }

    existing.next_revision_at = nextRevisionDate;
    existing.assessment = {
      ...existing.assessment,
      nextRevisionDate,
    };

    return res.json({ success: true, nextRevisionDate });
  }
});

// ------------------------------------------------------------------------------
// GET /api/analytics - Comprehensive analytics and dashboard metrics
// ------------------------------------------------------------------------------
router.get('/analytics', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const requestedTz = req.query.tz;

  try {
    // 1. Fetch user settings
    let userSettings = {};
    try {
      const { rows: setRows } = await pool.query(
        'SELECT * FROM user_settings WHERE user_id = $1',
        [userId]
      );
      if (setRows.length > 0) {
        userSettings = setRows[0];
      }
    } catch {}

    const timeZone = requestedTz || userSettings.timezone || 'UTC';

    // 2. Fetch problems with topics, mistakes, and revisions
    const { rows: problemRows } = await pool.query(
      `SELECT 
        p.id, p.title, p.platform, p.difficulty, p.solving_status, p.solved_at,
        p.reviewed_better_solution, p.confidence_level, p.can_solve_independently,
        p.next_revision_at, p.created_at,
        COALESCE((SELECT json_agg(t.name) FROM problem_topics pt JOIN topics t ON pt.topic_id = t.id WHERE pt.problem_id = p.id), '[]'::json) as topics,
        COALESCE((SELECT json_agg(pm.mistake_category) FROM problem_mistakes pm WHERE pm.problem_id = p.id), '[]'::json) as mistakes,
        COALESCE((SELECT json_agg(json_build_object('id', r.id, 'date', to_char(r.scheduled_at, 'YYYY-MM-DD'), 'completed_at', r.completed_at, 'result', r.result))
                  FROM revisions r WHERE r.problem_id = p.id), '[]'::json) as revisions
      FROM problems p
      WHERE p.user_id = $1`,
      [userId]
    );

    // 3. Fetch all completed revisions for this user's problems
    const { rows: revRows } = await pool.query(
      `SELECT r.id, r.problem_id, r.scheduled_at, r.completed_at, r.result, r.notes
       FROM revisions r
       JOIN problems p ON r.problem_id = p.id
       WHERE p.user_id = $1 AND r.completed_at IS NOT NULL`,
      [userId]
    );

    const analytics = computeUserAnalytics({
      problems: problemRows,
      revisions: revRows,
      userSettings: {
        dailyProblemGoal: userSettings.daily_problem_goal,
        dailyRevisionGoal: userSettings.daily_revision_goal,
        dailyGoal: userSettings.daily_problem_goal,
        weeklyGoal: userSettings.weekly_problem_goal,
      },
      timeZone,
    });

    return res.json(analytics);
  } catch (err) {
    // In-memory fallback
    const memSettings = memoryUserSettings.get(userId) || {};
    const timeZone = requestedTz || memSettings.timezone || 'UTC';

    const userProblems = Array.from(memoryProblems.values())
      .filter((p) => p.userId === userId)
      .map((p) => {
        const topics = Array.from(memoryProblemTopics.get(p.id) || []);
        const mistakes = Array.from(memoryMistakes.get(p.id) || []);
        const revs = Array.from(memoryRevisions.values()).filter((r) => r.problemId === p.id);
        return {
          id: p.id,
          title: p.title,
          platform: p.platform,
          difficulty: p.difficulty,
          solving_status: p.solving_status || p.status,
          solved_at: p.solved_at || p.solvingDate,
          reviewed_better_solution: Boolean(p.reviewed_better_solution ?? p.improvedSolution?.reviewed),
          confidence_level: p.confidence_level ?? p.assessment?.confidenceRating,
          can_solve_independently: Boolean(p.can_solve_independently ?? p.assessment?.canSolveAgain),
          next_revision_at: p.next_revision_at || p.assessment?.nextRevisionDate,
          created_at: p.created_at || p.createdAt,
          topics,
          mistakes,
          revisions: revs,
        };
      });

    const userRevisions = Array.from(memoryRevisions.values())
      .filter((r) => {
        const prob = memoryProblems.get(r.problemId);
        return prob && prob.userId === userId;
      });

    const analytics = computeUserAnalytics({
      problems: userProblems,
      revisions: userRevisions,
      userSettings: {
        dailyProblemGoal: memSettings.daily_problem_goal,
        dailyRevisionGoal: memSettings.daily_revision_goal,
        dailyGoal: memSettings.daily_problem_goal,
        weeklyGoal: memSettings.weekly_problem_goal,
      },
      timeZone,
    });

    return res.json(analytics);
  }
});

// ------------------------------------------------------------------------------
// GET /api/widget/summary - Lightweight endpoint for Android Home-Screen Widget
// ------------------------------------------------------------------------------
router.get('/widget/summary', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username;

  try {
    // 1. Fetch user settings for daily goal
    let dailyGoal = 3;
    try {
      const { rows: setRows } = await pool.query(
        'SELECT daily_problem_goal FROM user_settings WHERE user_id = $1',
        [userId]
      );
      if (setRows.length > 0 && setRows[0].daily_problem_goal) {
        dailyGoal = Number(setRows[0].daily_problem_goal);
      }
    } catch {}

    // 2. Query total, solved, difficulty counts, today's solved count, revisions due
    const { rows: probRows } = await pool.query(
      `SELECT
        COUNT(*)::int AS total_problems,
        COUNT(CASE WHEN solving_status NOT IN ('Unable To Solve', 'Unsolved') THEN 1 END)::int AS solved_count,
        COUNT(CASE WHEN difficulty = 'Easy' THEN 1 END)::int AS easy_count,
        COUNT(CASE WHEN difficulty = 'Medium' THEN 1 END)::int AS medium_count,
        COUNT(CASE WHEN difficulty = 'Hard' THEN 1 END)::int AS hard_count,
        COUNT(CASE WHEN solved_at::date = CURRENT_DATE AND solving_status NOT IN ('Unable To Solve', 'Unsolved') THEN 1 END)::int AS today_solved,
        COUNT(CASE WHEN next_revision_at IS NOT NULL AND next_revision_at <= CURRENT_TIMESTAMP THEN 1 END)::int AS revisions_due
       FROM problems
       WHERE user_id = $1`,
      [userId]
    );

    const stats = probRows[0] || {};
    const totalProblems = stats.total_problems || 0;
    const solvedCount = stats.solved_count || 0;
    const remainingCount = Math.max(0, totalProblems - solvedCount);
    const todaySolved = stats.today_solved || 0;
    const revisionsDue = stats.revisions_due || 0;
    const dailyGoalProgress = Math.min(100, Math.round((todaySolved / Math.max(1, dailyGoal)) * 100));

    // 3. Simple streak calculation from problems & revisions
    let currentStreak = 0;
    try {
      const { rows: solveDates } = await pool.query(
        `SELECT DISTINCT (solved_at::date)::text AS active_date
         FROM problems
         WHERE user_id = $1 AND solving_status NOT IN ('Unable To Solve', 'Unsolved') AND solved_at IS NOT NULL
         UNION
         SELECT DISTINCT (r.completed_at::date)::text AS active_date
         FROM revisions r
         JOIN problems p ON r.problem_id = p.id
         WHERE p.user_id = $1 AND r.completed_at IS NOT NULL
         ORDER BY active_date DESC`,
        [userId]
      );

      const activeDates = new Set(solveDates.map((r) => r.active_date));
      const now = new Date();
      let checkDate = new Date(now);
      const todayStr = checkDate.toISOString().split('T')[0];
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = checkDate.toISOString().split('T')[0];

      let streakDate = activeDates.has(todayStr) ? new Date(now) : (activeDates.has(yesterdayStr) ? checkDate : null);
      if (streakDate) {
        while (true) {
          const dStr = streakDate.toISOString().split('T')[0];
          if (activeDates.has(dStr)) {
            currentStreak++;
            streakDate.setDate(streakDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
    } catch {}

    res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return res.status(200).json({
      username,
      totalProblems,
      solvedCount,
      remainingCount,
      todaySolved,
      dailyGoal,
      dailyGoalProgress,
      currentStreak,
      revisionsDue,
      difficultyCounts: {
        Easy: stats.easy_count || 0,
        Medium: stats.medium_count || 0,
        Hard: stats.hard_count || 0,
      },
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Widget summary error:', err);
    // Memory fallback if DB is offline or table unconfigured
    const userProblems = Array.from(memoryProblems.values()).filter((p) => p.userId === userId);
    const solved = userProblems.filter(isSolvedProblem);
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySolved = solved.filter((p) => {
      const d = p.solved_at || p.solvingDate;
      return d && String(d).startsWith(todayStr);
    }).length;
    const totalProblems = userProblems.length;
    const solvedCount = solved.length;

    res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    return res.status(200).json({
      username,
      totalProblems,
      solvedCount,
      remainingCount: Math.max(0, totalProblems - solvedCount),
      todaySolved,
      dailyGoal: 3,
      dailyGoalProgress: Math.min(100, Math.round((todaySolved / 3) * 100)),
      currentStreak: 0,
      revisionsDue: 0,
      difficultyCounts: {
        Easy: userProblems.filter((p) => p.difficulty === 'Easy').length,
        Medium: userProblems.filter((p) => p.difficulty === 'Medium').length,
        Hard: userProblems.filter((p) => p.difficulty === 'Hard').length,
      },
      lastSyncedAt: new Date().toISOString(),
    });
  }
});

export default router;
