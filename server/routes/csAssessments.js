import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../../db/pool.js';

const router = express.Router();
router.use(authenticateToken);

// ── Helper: get the user's current active topic global_seq ────────────────────
// (duplicated here to keep this file self-contained — must stay consistent
//  with csFundamentals.js)
async function getActiveTopicSeq(client, userId) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(t.global_seq), 0) AS last_completed_seq
     FROM user_cs_progress ucp
     JOIN cs_topics t ON t.id = ucp.topic_id
     WHERE ucp.user_id = $1 AND ucp.completed = TRUE`,
    [userId]
  );
  return (rows[0]?.last_completed_seq ?? 0) + 1;
}

// ── Helper: check if request is from demo account ────────────────────────────
function isDemoUser(req) {
  return (req.user?.username || '').toLowerCase() === 'demo';
}

// ── Helper: check if a topic is accessible (active or completed) ──────────────
async function getTopicAccess(client, userId, topicId, isDemo = false) {
  const { rows } = await client.query(
    `SELECT t.id, t.global_seq,
            COALESCE(ucp.completed, FALSE) AS completed
     FROM cs_topics t
     LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1
     WHERE t.id = $2`,
    [userId, topicId]
  );

  if (rows.length === 0) return { found: false };

  const topic = rows[0];

  if (isDemo) {
    return {
      found: true,
      topic,
      isActive: true,
      isCompleted: topic.completed,
      accessible: true,
      activeSeq: topic.global_seq,
    };
  }

  const activeSeq = await getActiveTopicSeq(client, userId);
  const isActive = topic.global_seq === activeSeq;
  const isCompleted = topic.completed;
  const accessible = isActive || isCompleted;

  return { found: true, topic, isActive, isCompleted, accessible, activeSeq };
}

// ── Helper: get next attempt number for user+topic ────────────────────────────
async function getNextAttemptNumber(client, userId, topicId) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next
     FROM user_cs_assessment_attempts
     WHERE user_id = $1 AND topic_id = $2`,
    [userId, topicId]
  );
  return rows[0].next;
}

// ── GET /api/cs-assessments/topics/:topicId/assessment ────────────────────────
// Returns assessment config + questions (WITHOUT answer keys) + past attempts summary.
router.get('/topics/:topicId/assessment', async (req, res) => {
  const userId = req.user.id;
  const topicId = parseInt(req.params.topicId, 10);
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid topic id.' });
  }

  try {
    const client = await pool.connect();
    try {
      const access = await getTopicAccess(client, userId, topicId, isDemoUser(req));
      if (!access.found) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Topic not found.' });
      }
      if (!access.accessible) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Topic is locked.' });
      }

      // Assessment config (may not exist — default to optional)
      const { rows: configRows } = await client.query(
        `SELECT is_mandatory, passing_score, question_count
         FROM cs_topic_assessment_config
         WHERE topic_id = $1`,
        [topicId]
      );
      const config = configRows[0] || { is_mandatory: false, passing_score: 70, question_count: null };

      // Questions — omit correct_answer to prevent cheating
      const { rows: questions } = await client.query(
        `SELECT id, seq, question_type, question_text, options, difficulty
         FROM cs_assessment_questions
         WHERE topic_id = $1
         ORDER BY seq
         LIMIT $2`,
        [topicId, config.question_count || 1000]
      );

      // Past attempts summary (most recent 5)
      const { rows: attempts } = await client.query(
        `SELECT id, attempt_number, score, passed, total_questions, correct_count, submitted_at
         FROM user_cs_assessment_attempts
         WHERE user_id = $1 AND topic_id = $2
         ORDER BY attempt_number DESC
         LIMIT 5`,
        [userId, topicId]
      );

      // Check if user has a passing attempt
      const hasPassed = attempts.some((a) => a.passed);

      return res.json({
        topic_id: topicId,
        has_questions: questions.length > 0,
        config,
        questions,
        attempts,
        has_passed: hasPassed,
        can_attempt: access.isActive || access.isCompleted,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-assessments GET error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load assessment.' });
  }
});

// ── POST /api/cs-assessments/topics/:topicId/assessment ───────────────────────
// Submit answers. Backend calculates score. Returns result + explanations.
// Body: { answers: { [question_id]: "user answer string" } }
router.post('/topics/:topicId/assessment', async (req, res) => {
  const userId = req.user.id;
  const topicId = parseInt(req.params.topicId, 10);
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid topic id.' });
  }

  const { answers } = req.body;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'answers must be an object mapping question_id to answer string.',
    });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const access = await getTopicAccess(client, userId, topicId, isDemoUser(req));
      if (!access.found) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Topic not found.' });
      }
      if (!access.accessible) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Topic is locked.' });
      }

      // Fetch questions WITH correct answers for server-side evaluation
      const { rows: questions } = await client.query(
        `SELECT id, seq, question_type, question_text, options, correct_answer, explanation, difficulty
         FROM cs_assessment_questions
         WHERE topic_id = $1
         ORDER BY seq`,
        [topicId]
      );

      if (questions.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'NO_QUESTIONS',
          message: 'No assessment questions available for this topic.',
        });
      }

      // Validate that all submitted question IDs belong to this topic
      const validIds = new Set(questions.map((q) => String(q.id)));
      for (const qid of Object.keys(answers)) {
        if (!validIds.has(qid)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: `Question id ${qid} does not belong to this topic.`,
          });
        }
      }

      // Evaluate answers on the server
      let correctCount = 0;
      const evaluatedAnswers = [];

      for (const question of questions) {
        const userAnswer = answers[String(question.id)];
        if (userAnswer === undefined) continue; // Question not answered — treated as wrong

        let isCorrect = false;
        if (question.question_type === 'mcq') {
          // Exact string match (case-insensitive trim)
          isCorrect = userAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
        } else {
          // Short answer / conceptual — mark based on key phrase presence
          // Simple keyword matching for deterministic evaluation
          const answerLower = userAnswer.trim().toLowerCase();
          const keyPhrases = question.correct_answer.toLowerCase().split('|').map((p) => p.trim());
          // If correct_answer has | delimiters, any phrase match counts
          // Otherwise check if user answer contains at least half of significant words
          if (keyPhrases.length > 1) {
            isCorrect = keyPhrases.some((phrase) => answerLower.includes(phrase));
          } else {
            const words = question.correct_answer
              .toLowerCase()
              .replace(/[^a-z0-9 ]/g, '')
              .split(/\s+/)
              .filter((w) => w.length > 4);
            const matchCount = words.filter((w) => answerLower.includes(w)).length;
            isCorrect = words.length > 0 && matchCount >= Math.ceil(words.length * 0.4);
          }
        }

        if (isCorrect) correctCount++;

        evaluatedAnswers.push({
          question_id: question.id,
          user_answer: userAnswer,
          is_correct: isCorrect,
          correct_answer: question.correct_answer,
          explanation: question.explanation,
          question_text: question.question_text,
          question_type: question.question_type,
          options: question.options,
        });
      }

      const totalAnswered = evaluatedAnswers.length;
      const scoreRaw = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;
      const score = Math.round(scoreRaw * 100) / 100;

      // Get assessment config
      const { rows: configRows } = await client.query(
        `SELECT is_mandatory, passing_score
         FROM cs_topic_assessment_config
         WHERE topic_id = $1`,
        [topicId]
      );
      const config = configRows[0] || { is_mandatory: false, passing_score: 70 };
      const passed = score >= config.passing_score;

      // Save attempt
      const attemptNumber = await getNextAttemptNumber(client, userId, topicId);

      const { rows: attemptRows } = await client.query(
        `INSERT INTO user_cs_assessment_attempts
           (user_id, topic_id, attempt_number, score, passed, total_questions, correct_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [userId, topicId, attemptNumber, score, passed, totalAnswered, correctCount]
      );
      const attemptId = attemptRows[0].id;

      // Save per-question answers
      for (const ea of evaluatedAnswers) {
        await client.query(
          `INSERT INTO user_cs_assessment_answers (attempt_id, question_id, user_answer, is_correct)
           VALUES ($1, $2, $3, $4)`,
          [attemptId, ea.question_id, ea.user_answer, ea.is_correct]
        );
      }

      await client.query('COMMIT');

      return res.json({
        attempt_id: attemptId,
        attempt_number: attemptNumber,
        score,
        passed,
        correct_count: correctCount,
        total_questions: totalAnswered,
        passing_score: config.passing_score,
        is_mandatory: config.is_mandatory,
        results: evaluatedAnswers.map(({ correct_answer, ...rest }) => ({
          ...rest,
          correct_answer: rest.is_correct ? correct_answer : correct_answer, // always show after submission
        })),
        feedback: passed
          ? `Great job! You scored ${score.toFixed(0)}% — passed! 🎉`
          : `You scored ${score.toFixed(0)}%. You need ${config.passing_score}% to pass. Review the explanations and try again.`,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-assessments POST error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to submit assessment.' });
  }
});

// ── GET /api/cs-assessments/topics/:topicId/assessment/attempts ───────────────
// Full attempt history with per-question answers and explanations.
router.get('/topics/:topicId/assessment/attempts', async (req, res) => {
  const userId = req.user.id;
  const topicId = parseInt(req.params.topicId, 10);
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid topic id.' });
  }

  try {
    const client = await pool.connect();
    try {
      const access = await getTopicAccess(client, userId, topicId, isDemoUser(req));
      if (!access.found) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Topic not found.' });
      }
      if (!access.accessible) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Topic is locked.' });
      }

      const { rows: attempts } = await client.query(
        `SELECT id, attempt_number, score, passed, total_questions, correct_count, submitted_at
         FROM user_cs_assessment_attempts
         WHERE user_id = $1 AND topic_id = $2
         ORDER BY attempt_number DESC`,
        [userId, topicId]
      );

      // Load answers for each attempt
      const full = [];
      for (const attempt of attempts) {
        const { rows: answerRows } = await client.query(
          `SELECT uaa.user_answer, uaa.is_correct,
                  q.question_text, q.question_type, q.options,
                  q.correct_answer, q.explanation, q.seq
           FROM user_cs_assessment_answers uaa
           JOIN cs_assessment_questions q ON q.id = uaa.question_id
           WHERE uaa.attempt_id = $1
           ORDER BY q.seq`,
          [attempt.id]
        );
        full.push({ ...attempt, answers: answerRows });
      }

      return res.json({ topic_id: topicId, attempts: full });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-assessments attempts GET error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load attempts.' });
  }
});

// ── GET /api/cs-assessments/topics/:topicId/pass-status ──────────────────────
// Quick check: has the user passed the mandatory assessment (if any)?
router.get('/topics/:topicId/pass-status', async (req, res) => {
  const userId = req.user.id;
  const topicId = parseInt(req.params.topicId, 10);
  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid topic id.' });
  }

  if (isDemoUser(req)) {
    return res.json({ is_mandatory: false, has_passed: true, assessment_required: false });
  }

  try {
    const client = await pool.connect();
    try {
      const { rows: configRows } = await client.query(
        `SELECT is_mandatory, passing_score FROM cs_topic_assessment_config WHERE topic_id = $1`,
        [topicId]
      );
      const config = configRows[0];

      if (!config || !config.is_mandatory) {
        return res.json({ is_mandatory: false, has_passed: true, assessment_required: false });
      }

      const { rows: passRows } = await client.query(
        `SELECT EXISTS(
           SELECT 1 FROM user_cs_assessment_attempts
           WHERE user_id = $1 AND topic_id = $2 AND passed = TRUE
         ) AS has_passed`,
        [userId, topicId]
      );

      const hasPassed = passRows[0].has_passed;
      return res.json({
        is_mandatory: true,
        passing_score: config.passing_score,
        has_passed: hasPassed,
        assessment_required: !hasPassed,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-assessments pass-status error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to check pass status.' });
  }
});

export default router;
