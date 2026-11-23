import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { pool } from '../../db/pool.js';

const router = express.Router();

// ── All routes require authentication ─────────────────────────────────────────
router.use(authenticateToken);

// ── Helper: check if the request is from the demo account ─────────────────────
function isDemoUser(req) {
  const username = (req.user?.username || '').toLowerCase();
  return username === 'demo';
}

// ── Helper: get the user's recommended active topic ──────────────────────────
// Finds the first incomplete topic (prioritizing Phase 1, then lowest global_seq)
// whose prerequisites are all completed.
async function getRecommendedActiveTopic(client, userId) {
  try {
    const { rows } = await client.query(
      `SELECT t.id, t.global_seq, COALESCE(t.phase, 1) AS phase, t.title
       FROM cs_topics t
       LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1 AND ucp.completed = TRUE
       WHERE (ucp.completed IS NULL OR ucp.completed = FALSE)
         AND NOT EXISTS (
           SELECT 1 FROM cs_topic_prerequisites p
           LEFT JOIN user_cs_progress pr_ucp ON pr_ucp.topic_id = p.prereq_topic_id AND pr_ucp.user_id = $1 AND pr_ucp.completed = TRUE
           WHERE p.topic_id = t.id AND (pr_ucp.completed IS NULL OR pr_ucp.completed = FALSE)
         )
       ORDER BY COALESCE(t.phase, 1) ASC, t.global_seq ASC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  } catch (err) {
    // Graceful fallback if cs_topic_prerequisites is pending or unavailable
    const { rows } = await client.query(
      `SELECT t.id, t.global_seq, 1 AS phase, t.title
       FROM cs_topics t
       LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1 AND ucp.completed = TRUE
       WHERE (ucp.completed IS NULL OR ucp.completed = FALSE)
       ORDER BY t.global_seq ASC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  }
}

async function getActiveTopicSeq(client, userId) {
  const active = await getRecommendedActiveTopic(client, userId);
  return active ? active.global_seq : 1;
}

// ── GET /api/cs-fundamentals/curriculum ───────────────────────────────────────
// Returns the full curriculum tree with user progress overlaid.
router.get('/curriculum', async (req, res) => {
  const userId = req.user.id;
  const isDemo = isDemoUser(req);
  try {
    const client = await pool.connect();
    try {
      const activeTopic = await getRecommendedActiveTopic(client, userId);
      const activeSeq = activeTopic ? activeTopic.global_seq : null;

      // All modules
      const { rows: modules } = await client.query(
        'SELECT id, seq, title, description FROM cs_modules ORDER BY seq'
      );

      // All sections
      const { rows: sections } = await client.query(
        'SELECT id, module_id, seq, title FROM cs_sections ORDER BY module_id, seq'
      );

      // All topics with user progress and metadata
      const { rows: topics } = await client.query(
        `SELECT t.id, t.module_id, t.section_id, t.global_seq, t.section_seq,
                t.title, t.description, t.objectives, t.est_minutes,
                COALESCE(t.phase, 1) AS phase,
                COALESCE(t.stage, '') AS stage,
                COALESCE(t.primary_language, 'cpp') AS primary_language,
                COALESCE(t.is_optional, FALSE) AS is_optional,
                COALESCE(ucp.completed, FALSE) AS completed,
                ucp.completed_at
         FROM cs_topics t
         LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1
         ORDER BY t.global_seq`,
        [userId]
      );

      // Prerequisites for all topics (with userId parameter)
      let prereqRows = [];
      try {
        const { rows } = await client.query(
          `SELECT p.topic_id, p.prereq_topic_id, pt.global_seq AS prereq_global_seq,
                  pt.title AS prereq_title, COALESCE(ucp.completed, FALSE) AS prereq_completed
           FROM cs_topic_prerequisites p
           JOIN cs_topics pt ON pt.id = p.prereq_topic_id
           LEFT JOIN user_cs_progress ucp ON ucp.topic_id = pt.id AND ucp.user_id = $1`,
          [userId]
        );
        prereqRows = rows;
      } catch (prereqErr) {
        console.warn('Could not query cs_topic_prerequisites:', prereqErr.message);
        prereqRows = [];
      }

      const prereqMap = {};
      for (const pr of prereqRows) {
        if (!prereqMap[pr.topic_id]) prereqMap[pr.topic_id] = [];
        prereqMap[pr.topic_id].push({
          id: pr.prereq_topic_id,
          global_seq: pr.prereq_global_seq,
          title: pr.prereq_title,
          completed: pr.prereq_completed,
        });
      }

      // Total topics for stats
      const totalTopics = topics.length;
      const completedTopics = topics.filter((t) => t.completed).length;
      const phase1Topics = topics.filter((t) => t.phase === 1);
      const phase1Completed = phase1Topics.filter((t) => t.completed).length;
      const phase2Topics = topics.filter((t) => t.phase === 2);
      const phase2Completed = phase2Topics.filter((t) => t.completed).length;

      // Build the nested structure
      const moduleMap = {};
      for (const mod of modules) {
        moduleMap[mod.id] = {
          id: mod.id,
          seq: mod.seq,
          title: mod.title,
          description: mod.description,
          sections: [],
        };
      }

      const sectionMap = {};
      for (const sec of sections) {
        sectionMap[sec.id] = {
          id: sec.id,
          module_id: sec.module_id,
          seq: sec.seq,
          title: sec.title,
          topics: [],
        };
        if (moduleMap[sec.module_id]) {
          moduleMap[sec.module_id].sections.push(sectionMap[sec.id]);
        }
      }

      for (const topic of topics) {
        const prereqs = prereqMap[topic.id] || [];
        const allPrereqsMet = prereqs.length === 0 || prereqs.every((p) => p.completed);

        let status;
        if (topic.completed) {
          status = 'completed';
        } else if (isDemo) {
          // Demo account has unrestricted access to all topics across all modules
          status = (topic.global_seq === (activeSeq || 1)) ? 'active' : 'unlocked';
        } else if (allPrereqsMet) {
          status = (topic.global_seq === activeSeq) ? 'active' : 'unlocked';
        } else {
          status = 'locked';
        }

        const topicObj = {
          id: topic.id,
          global_seq: topic.global_seq,
          section_seq: topic.section_seq,
          title: topic.title,
          description: topic.description,
          objectives: topic.objectives,
          est_minutes: topic.est_minutes,
          phase: topic.phase,
          stage: topic.stage,
          primary_language: topic.primary_language,
          is_optional: topic.is_optional,
          prerequisites: prereqs,
          completed: topic.completed,
          completed_at: topic.completed_at,
          status,
        };

        if (sectionMap[topic.section_id]) {
          sectionMap[topic.section_id].topics.push(topicObj);
        }
      }

      const curriculumList = Object.values(moduleMap).sort((a, b) => a.seq - b.seq);

      // Compute per-module stats
      for (const mod of curriculumList) {
        let modTotal = 0;
        let modCompleted = 0;
        let modPhase1Total = 0;
        let modPhase1Completed = 0;
        let modPhase2Total = 0;
        let modPhase2Completed = 0;

        for (const sec of mod.sections) {
          modTotal += sec.topics.length;
          modCompleted += sec.topics.filter((t) => t.completed).length;
          modPhase1Total += sec.topics.filter((t) => t.phase === 1).length;
          modPhase1Completed += sec.topics.filter((t) => t.phase === 1 && t.completed).length;
          modPhase2Total += sec.topics.filter((t) => t.phase === 2).length;
          modPhase2Completed += sec.topics.filter((t) => t.phase === 2 && t.completed).length;
        }
        mod.total_topics = modTotal;
        mod.completed_topics = modCompleted;
        mod.phase1_total = modPhase1Total;
        mod.phase1_completed = modPhase1Completed;
        mod.phase2_total = modPhase2Total;
        mod.phase2_completed = modPhase2Completed;
        mod.is_completed = modTotal > 0 && modTotal === modCompleted;
      }

      return res.json({
        modules: curriculumList,
        is_demo: isDemo,
        stats: {
          total_modules: modules.length,
          total_topics: totalTopics,
          completed_topics: completedTopics,
          remaining_topics: totalTopics - completedTopics,
          completion_percentage:
            totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
          phase1_total: phase1Topics.length,
          phase1_completed: phase1Completed,
          phase1_percentage:
            phase1Topics.length > 0 ? Math.round((phase1Completed / phase1Topics.length) * 100) : 0,
          phase2_total: phase2Topics.length,
          phase2_completed: phase2Completed,
          phase2_percentage:
            phase2Topics.length > 0 ? Math.round((phase2Completed / phase2Topics.length) * 100) : 0,
          active_topic_seq: activeSeq,
          curriculum_complete: completedTopics === totalTopics && totalTopics > 0,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals curriculum error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load curriculum.',
    });
  }
});

// ── GET /api/cs-fundamentals/active-topic ─────────────────────────────────────
router.get('/active-topic', async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();
    try {
      const activeTopic = await getRecommendedActiveTopic(client, userId);

      if (!activeTopic) {
        return res.json({ curriculum_complete: true, active_topic: null });
      }

      const { rows } = await client.query(
        `SELECT t.id, t.module_id, t.section_id, t.global_seq, t.section_seq,
                t.title, t.description, t.objectives, t.est_minutes,
                COALESCE(t.phase, 1) AS phase,
                COALESCE(t.stage, '') AS stage,
                COALESCE(t.primary_language, 'cpp') AS primary_language,
                COALESCE(t.is_optional, FALSE) AS is_optional,
                m.title AS module_title, m.seq AS module_seq,
                sec.title AS section_title, sec.seq AS section_seq_val,
                FALSE AS completed
         FROM cs_topics t
         JOIN cs_modules m ON m.id = t.module_id
         JOIN cs_sections sec ON sec.id = t.section_id
         WHERE t.id = $1`,
        [activeTopic.id]
      );

      if (rows.length === 0) {
        return res.json({ curriculum_complete: true, active_topic: null });
      }

      const topic = rows[0];

      // Get checklist items
      const { rows: items } = await client.query(
        `SELECT ci.id, ci.seq, ci.text,
                COALESCE(ucp.checked, FALSE) AS checked
         FROM cs_topic_checklist_items ci
         LEFT JOIN user_cs_checklist_progress ucp ON ucp.item_id = ci.id AND ucp.user_id = $1
         WHERE ci.topic_id = $2
         ORDER BY ci.seq`,
        [userId, topic.id]
      );

      // Get prerequisites
      const { rows: prereqs } = await client.query(
        `SELECT pt.id, pt.global_seq, pt.title, COALESCE(ucp.completed, FALSE) AS completed
         FROM cs_topic_prerequisites p
         JOIN cs_topics pt ON pt.id = p.prereq_topic_id
         LEFT JOIN user_cs_progress ucp ON ucp.topic_id = pt.id AND ucp.user_id = $1
         WHERE p.topic_id = $2`,
        [userId, topic.id]
      );

      return res.json({
        curriculum_complete: false,
        active_topic: {
          id: topic.id,
          global_seq: topic.global_seq,
          section_seq: topic.section_seq,
          title: topic.title,
          description: topic.description,
          objectives: topic.objectives,
          est_minutes: topic.est_minutes,
          phase: topic.phase,
          stage: topic.stage,
          primary_language: topic.primary_language,
          is_optional: topic.is_optional,
          prerequisites: prereqs,
          module_title: topic.module_title,
          module_seq: topic.module_seq,
          section_title: topic.section_title,
          section_seq_val: topic.section_seq_val,
          completed: false,
          status: 'active',
          checklist_items: items,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals active-topic error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load active topic.',
    });
  }
});

// ── GET /api/cs-fundamentals/topics/:id ───────────────────────────────────────
router.get('/topics/:id', async (req, res) => {
  const userId = req.user.id;
  const isDemo = isDemoUser(req);
  const topicId = parseInt(req.params.id, 10);

  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid topic id.' });
  }

  try {
    const client = await pool.connect();
    try {
      const activeTopic = await getRecommendedActiveTopic(client, userId);
      const activeSeq = activeTopic ? activeTopic.global_seq : null;

      const { rows } = await client.query(
        `SELECT t.id, t.module_id, t.section_id, t.global_seq, t.section_seq,
                t.title, t.description, t.objectives, t.est_minutes,
                COALESCE(t.phase, 1) AS phase,
                COALESCE(t.stage, '') AS stage,
                COALESCE(t.primary_language, 'cpp') AS primary_language,
                COALESCE(t.is_optional, FALSE) AS is_optional,
                m.title AS module_title, m.seq AS module_seq,
                sec.title AS section_title, sec.seq AS section_seq_val,
                COALESCE(ucp.completed, FALSE) AS completed,
                ucp.completed_at
         FROM cs_topics t
         JOIN cs_modules m ON m.id = t.module_id
         JOIN cs_sections sec ON sec.id = t.section_id
         LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1
         WHERE t.id = $2`,
        [userId, topicId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Topic not found.' });
      }

      const topic = rows[0];

      // Get prerequisites with user completion status
      const { rows: prereqs } = await client.query(
        `SELECT pt.id, pt.global_seq, pt.title, COALESCE(ucp.completed, FALSE) AS completed
         FROM cs_topic_prerequisites p
         JOIN cs_topics pt ON pt.id = p.prereq_topic_id
         LEFT JOIN user_cs_progress ucp ON ucp.topic_id = pt.id AND ucp.user_id = $1
         WHERE p.topic_id = $2
         ORDER BY pt.global_seq`,
        [userId, topic.id]
      );

      const allPrereqsMet = prereqs.length === 0 || prereqs.every((p) => p.completed);

      // Determine status
      let status;
      if (topic.completed) {
        status = 'completed';
      } else if (isDemo) {
        // Demo account: all topics are accessible & unlocked
        status = (topic.global_seq === (activeSeq || 1)) ? 'active' : 'unlocked';
      } else if (allPrereqsMet) {
        status = (topic.global_seq === activeSeq) ? 'active' : 'unlocked';
      } else {
        status = 'locked';
      }

      // Dependent topics (unlocks next)
      const { rows: unlocksNext } = await client.query(
        `SELECT dt.id, dt.global_seq, dt.title
         FROM cs_topic_prerequisites p
         JOIN cs_topics dt ON dt.id = p.topic_id
         WHERE p.prereq_topic_id = $1
         ORDER BY dt.global_seq`,
        [topic.id]
      );

      // Get checklist items
      const { rows: items } = await client.query(
        `SELECT ci.id, ci.seq, ci.text,
                COALESCE(ucp.checked, FALSE) AS checked
         FROM cs_topic_checklist_items ci
         LEFT JOIN user_cs_checklist_progress ucp ON ucp.item_id = ci.id AND ucp.user_id = $1
         WHERE ci.topic_id = $2
         ORDER BY ci.seq`,
        [userId, topic.id]
      );

      // Previous topic in global sequence
      const { rows: prevRows } = await client.query(
        `SELECT id, title, global_seq FROM cs_topics WHERE global_seq < $1 ORDER BY global_seq DESC LIMIT 1`,
        [topic.global_seq]
      );

      // Next topic in global sequence
      const { rows: nextRows } = await client.query(
        `SELECT id, title, global_seq FROM cs_topics WHERE global_seq > $1 ORDER BY global_seq ASC LIMIT 1`,
        [topic.global_seq]
      );

      return res.json({
        id: topic.id,
        global_seq: topic.global_seq,
        section_seq: topic.section_seq,
        title: topic.title,
        description: topic.description,
        objectives: topic.objectives,
        est_minutes: topic.est_minutes,
        phase: topic.phase,
        stage: topic.stage,
        primary_language: topic.primary_language,
        is_optional: topic.is_optional,
        prerequisites: prereqs,
        unlocks_next: unlocksNext,
        module_title: topic.module_title,
        module_seq: topic.module_seq,
        section_title: topic.section_title,
        section_seq_val: topic.section_seq_val,
        completed: topic.completed,
        completed_at: topic.completed_at,
        status,
        is_demo: isDemo,
        prerequisites_satisfied: isDemo || allPrereqsMet,
        checklist_items: items,
        prev_topic: prevRows[0] || null,
        next_topic: nextRows[0] || null,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals topic detail error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load topic.',
    });
  }
});

// ── POST /api/cs-fundamentals/topics/:topicId/checklist/:itemId ───────────────
// Toggle a checklist item. Allowed on unlocked or completed topics.
router.post('/topics/:topicId/checklist/:itemId', async (req, res) => {
  const userId = req.user.id;
  const isDemo = isDemoUser(req);
  const topicId = parseInt(req.params.topicId, 10);
  const itemId = parseInt(req.params.itemId, 10);

  if (!topicId || isNaN(topicId) || !itemId || isNaN(itemId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid ids.' });
  }

  const { checked } = req.body;
  if (typeof checked !== 'boolean') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'checked must be a boolean.' });
  }

  try {
    const client = await pool.connect();
    try {
      // Verify topic exists
      const { rows: topicRows } = await client.query(
        'SELECT id, global_seq FROM cs_topics WHERE id = $1',
        [topicId]
      );
      if (topicRows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Topic not found.' });
      }

      // Check if topic is completed
      const isCompleted = (await client.query(
        'SELECT completed FROM user_cs_progress WHERE user_id = $1 AND topic_id = $2',
        [userId, topicId]
      )).rows[0]?.completed ?? false;

      // If not completed (and not demo), verify prerequisites are met
      if (!isCompleted && !isDemo) {
        const { rows: missingPrereqs } = await client.query(
          `SELECT pt.title
           FROM cs_topic_prerequisites p
           JOIN cs_topics pt ON pt.id = p.prereq_topic_id
           LEFT JOIN user_cs_progress ucp ON ucp.topic_id = p.prereq_topic_id AND ucp.user_id = $1 AND ucp.completed = TRUE
           WHERE p.topic_id = $2 AND (ucp.completed IS NULL OR ucp.completed = FALSE)`,
          [userId, topicId]
        );
        if (missingPrereqs.length > 0) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You can only update checklist items for unlocked or completed topics.',
          });
        }
      }

      // Verify checklist item belongs to this topic
      const { rows: itemRows } = await client.query(
        'SELECT id FROM cs_topic_checklist_items WHERE id = $1 AND topic_id = $2',
        [itemId, topicId]
      );
      if (itemRows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Checklist item not found.' });
      }

      // Upsert checklist progress
      await client.query(
        `INSERT INTO user_cs_checklist_progress (user_id, item_id, checked)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET checked = $3`,
        [userId, itemId, checked]
      );

      // ── Daily Learning: log study activity (qualifying event for streak) ──
      await client.query(
        `INSERT INTO user_cs_study_log (user_id, topic_id, activity)
         VALUES ($1, $2, 'checklist_updated')`,
        [userId, topicId]
      );

      return res.json({ success: true, checked });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals checklist toggle error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to update checklist item.',
    });
  }
});

// ── POST /api/cs-fundamentals/topics/:id/complete ─────────────────────────────
// Mark an unlocked topic as complete. Enforces prerequisite satisfaction & assessment gates.
router.post('/topics/:id/complete', async (req, res) => {
  const userId = req.user.id;
  const isDemo = isDemoUser(req);
  const topicId = parseInt(req.params.id, 10);

  if (!topicId || isNaN(topicId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid topic id.' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch the topic
      const { rows: topicRows } = await client.query(
        'SELECT id, global_seq, phase, title FROM cs_topics WHERE id = $1',
        [topicId]
      );
      if (topicRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Topic not found.' });
      }

      const topic = topicRows[0];

      // Check if already completed (idempotent guard)
      const { rows: existingRows } = await client.query(
        'SELECT completed FROM user_cs_progress WHERE user_id = $1 AND topic_id = $2',
        [userId, topicId]
      );
      if (existingRows[0]?.completed) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'ALREADY_COMPLETED',
          message: 'This topic is already marked as complete.',
        });
      }

      // ── Prerequisite gate: verify all prerequisites are completed (bypassed for demo user) ──────────
      if (!isDemo) {
        const { rows: missingPrereqs } = await client.query(
          `SELECT pt.id, pt.title, pt.global_seq
           FROM cs_topic_prerequisites p
           JOIN cs_topics pt ON pt.id = p.prereq_topic_id
           LEFT JOIN user_cs_progress ucp ON ucp.topic_id = p.prereq_topic_id AND ucp.user_id = $1 AND ucp.completed = TRUE
           WHERE p.topic_id = $2 AND (ucp.completed IS NULL OR ucp.completed = FALSE)`,
          [userId, topicId]
        );
        if (missingPrereqs.length > 0) {
          await client.query('ROLLBACK');
          return res.status(403).json({
            error: 'PREREQUISITES_NOT_MET',
            message: `Cannot complete topic until its prerequisites are completed: ${missingPrereqs.map((p) => p.title).join(', ')}.`,
            missing_prerequisites: missingPrereqs,
          });
        }
      }

      // ── Assessment gate: if mandatory assessment exists and user hasn't passed, block (bypassed for demo user) ──
      if (!isDemo) {
        const { rows: assessCfgRows } = await client.query(
          `SELECT is_mandatory, passing_score FROM cs_topic_assessment_config WHERE topic_id = $1`,
          [topicId]
        );
        if (assessCfgRows[0]?.is_mandatory) {
          const { rows: passRows } = await client.query(
            `SELECT EXISTS(
               SELECT 1 FROM user_cs_assessment_attempts
               WHERE user_id = $1 AND topic_id = $2 AND passed = TRUE
             ) AS has_passed`,
            [userId, topicId]
          );
          if (!passRows[0].has_passed) {
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: 'ASSESSMENT_REQUIRED',
              message: `You must pass the knowledge assessment (${assessCfgRows[0].passing_score}% or above) before completing this topic.`,
              passing_score: assessCfgRows[0].passing_score,
            });
          }
        }
      }

      // Mark complete in user progress
      await client.query(
        `INSERT INTO user_cs_progress (user_id, topic_id, completed, completed_at)
         VALUES ($1, $2, TRUE, NOW())
         ON CONFLICT (user_id, topic_id) DO UPDATE SET completed = TRUE, completed_at = NOW()`,
        [userId, topicId]
      );

      // Find next recommended active topic
      const nextTopic = await getRecommendedActiveTopic(client, userId);

      const totalTopics = (await client.query('SELECT COUNT(*) FROM cs_topics')).rows[0].count;
      const completedTopics = (await client.query(
        'SELECT COUNT(*) FROM user_cs_progress WHERE user_id = $1 AND completed = TRUE',
        [userId]
      )).rows[0].count;

      await client.query('COMMIT');

      // ── Daily Learning: log completion (outside transaction — non-critical) ─
      try {
        await client.query(
          `INSERT INTO user_cs_study_log (user_id, topic_id, activity)
           VALUES ($1, $2, 'completed')`,
          [userId, topicId]
        );
      } catch (_) {
        // Best-effort
      }

      return res.json({
        success: true,
        completed_topic_id: topicId,
        next_topic: nextTopic || null,
        curriculum_complete: nextTopic === null,
        stats: {
          total_topics: parseInt(totalTopics, 10),
          completed_topics: parseInt(completedTopics, 10),
          completion_percentage: Math.round((parseInt(completedTopics, 10) / parseInt(totalTopics, 10)) * 100),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals complete error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to complete topic.',
    });
  }
});

// ── GET /api/cs-fundamentals/stats ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();
    try {
      const activeSeq = await getActiveTopicSeq(client, userId);

      const { rows: totalRows } = await client.query('SELECT COUNT(*)::int AS total FROM cs_topics');
      const totalTopics = totalRows[0].total;

      const { rows: completedRows } = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM user_cs_progress WHERE user_id = $1 AND completed = TRUE',
        [userId]
      );
      const completedTopics = completedRows[0].cnt;

      // Recently completed topics (last 5)
      const { rows: recentRows } = await client.query(
        `SELECT t.id, t.title, t.global_seq, ucp.completed_at,
                m.title AS module_title
         FROM user_cs_progress ucp
         JOIN cs_topics t ON t.id = ucp.topic_id
         JOIN cs_modules m ON m.id = t.module_id
         WHERE ucp.user_id = $1 AND ucp.completed = TRUE
         ORDER BY ucp.completed_at DESC
         LIMIT 5`,
        [userId]
      );

      // Active topic
      const { rows: activeRows } = await client.query(
        `SELECT t.id, t.title, t.global_seq, m.title AS module_title, sec.title AS section_title,
                COALESCE(t.phase, 1) AS phase, COALESCE(t.stage, '') AS stage,
                COALESCE(t.primary_language, 'cpp') AS primary_language
         FROM cs_topics t
         JOIN cs_modules m ON m.id = t.module_id
         JOIN cs_sections sec ON sec.id = t.section_id
         WHERE t.global_seq = $1`,
        [activeSeq]
      );

      // Completed modules
      const { rows: modRows } = await client.query(
        `SELECT m.id, m.seq, m.title,
                COUNT(t.id)::int AS total_topics,
                COUNT(ucp.topic_id) FILTER (WHERE ucp.completed = TRUE)::int AS completed_topics
         FROM cs_modules m
         JOIN cs_topics t ON t.module_id = m.id
         LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1
         GROUP BY m.id, m.seq, m.title
         ORDER BY m.seq`,
        [userId]
      );

      const completedModules = modRows.filter((m) => m.total_topics === m.completed_topics);

      // Phase 1 and Phase 2 statistics
      let phase1Topics = 120, phase1Completed = 0, phase2Topics = 49, phase2Completed = 0;
      try {
        const { rows: phaseRows } = await client.query(
          `SELECT
             COUNT(t.id) FILTER (WHERE COALESCE(t.phase, 1) = 1)::int AS phase1_total,
             COUNT(t.id) FILTER (WHERE COALESCE(t.phase, 1) = 1 AND ucp.completed = TRUE)::int AS phase1_completed,
             COUNT(t.id) FILTER (WHERE t.phase = 2)::int AS phase2_total,
             COUNT(t.id) FILTER (WHERE t.phase = 2 AND ucp.completed = TRUE)::int AS phase2_completed
           FROM cs_topics t
           LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1`,
          [userId]
        );
        if (phaseRows.length > 0) {
          phase1Topics = phaseRows[0].phase1_total || 120;
          phase1Completed = phaseRows[0].phase1_completed || 0;
          phase2Topics = phaseRows[0].phase2_total || 49;
          phase2Completed = phaseRows[0].phase2_completed || 0;
        }
      } catch (_) {}

      // Current module progress
      let currentModuleProgress = null;
      if (activeRows.length > 0) {
        const activeTopic = activeRows[0];
        // Find which module this belongs to
        const currentMod = modRows.find((m) => {
          // crude check: look by the module_title
          return m.title === activeTopic.module_title;
        });
        if (currentMod) {
          currentModuleProgress = {
            module_title: currentMod.title,
            completed: currentMod.completed_topics,
            total: currentMod.total_topics,
            percentage: Math.round((currentMod.completed_topics / currentMod.total_topics) * 100),
          };
        }
      }

      return res.json({
        total_modules: modRows.length,
        total_topics: totalTopics,
        completed_topics: completedTopics,
        remaining_topics: totalTopics - completedTopics,
        completion_percentage:
          totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
        curriculum_complete: completedTopics === totalTopics && totalTopics > 0,
        active_topic: activeRows[0] || null,
        completed_modules: completedModules,
        current_module_progress: currentModuleProgress,
        recently_completed: recentRows,
        modules: modRows,
        phase1_topics: phase1Topics,
        phase1_completed: phase1Completed,
        phase2_topics: phase2Topics,
        phase2_completed: phase2Completed,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals stats error:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to load stats.',
    });
  }
});


// =============================================================================
// DAILY LEARNING EXPERIENCE
// =============================================================================

// ── Helper: resolve the effective timezone for CS learning ───────────────────
// Priority: cs_learning_timezone > user settings timezone > 'Asia/Kolkata'
async function getCsTimezone(client, userId) {
  const { rows } = await client.query(
    `SELECT COALESCE(cs_learning_timezone, timezone, 'Asia/Kolkata') AS tz
     FROM user_settings WHERE user_id = $1`,
    [userId]
  );
  return rows[0]?.tz || 'Asia/Kolkata';
}

// ── Helper: compute CS learning streak from study log ────────────────────────
// Mirrors the pattern of calculateStreak() in analyticsService.js but operates
// purely on user_cs_study_log. Does NOT modify the DSA streak logic.
async function computeCsStreak(client, userId, timeZone) {
  // Pull all distinct calendar dates where the user had qualifying activity
  const { rows } = await client.query(
    `SELECT DISTINCT
       TO_CHAR(logged_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day
     FROM user_cs_study_log
     WHERE user_id = $1
     ORDER BY day DESC`,
    [userId, timeZone]
  );

  if (rows.length === 0) return 0;

  const activeDates = new Set(rows.map((r) => r.day));

  // Replicate the calculateStreak logic without importing it
  const now = new Date();
  const fmt = (d) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString().split('T')[0];
    }
  };

  const todayStr = fmt(now);
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = fmt(yesterdayDate);

  let checkDate = now;
  let checkStr = todayStr;

  if (!activeDates.has(todayStr)) {
    if (activeDates.has(yesterdayStr)) {
      checkDate = yesterdayDate;
      checkStr = yesterdayStr;
    } else {
      return 0;
    }
  }

  let streak = 0;
  while (activeDates.has(checkStr)) {
    streak++;
    checkDate = new Date(checkDate.getTime() - 86400000);
    checkStr = fmt(checkDate);
  }

  return streak;
}

// ── GET /api/cs-fundamentals/daily ───────────────────────────────────────────
// "Today's Learning" panel — active topic, today's study log, goals, stats.
router.get('/daily', async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();
    try {
      const timeZone = await getCsTimezone(client, userId);
      const activeSeq = await getActiveTopicSeq(client, userId);

      // Active topic with checklist
      const { rows: topicRows } = await client.query(
        `SELECT t.id, t.module_id, t.section_id, t.global_seq, t.section_seq,
                t.title, t.description, t.objectives, t.est_minutes,
                m.title AS module_title, m.seq AS module_seq,
                sec.title AS section_title, sec.seq AS section_seq_val
         FROM cs_topics t
         JOIN cs_modules m ON m.id = t.module_id
         JOIN cs_sections sec ON sec.id = t.section_id
         WHERE t.global_seq = $1`,
        [activeSeq]
      );

      let activeTopic = null;
      let curriculumComplete = false;

      if (topicRows.length === 0) {
        curriculumComplete = true;
      } else {
        const topic = topicRows[0];
        const { rows: items } = await client.query(
          `SELECT ci.id, ci.seq, ci.text,
                  COALESCE(ucp.checked, FALSE) AS checked
           FROM cs_topic_checklist_items ci
           LEFT JOIN user_cs_checklist_progress ucp
             ON ucp.item_id = ci.id AND ucp.user_id = $1
           WHERE ci.topic_id = $2
           ORDER BY ci.seq`,
          [userId, topic.id]
        );
        activeTopic = {
          id: topic.id,
          global_seq: topic.global_seq,
          title: topic.title,
          description: topic.description,
          objectives: topic.objectives,
          est_minutes: topic.est_minutes,
          module_title: topic.module_title,
          module_seq: topic.module_seq,
          section_title: topic.section_title,
          status: 'active',
          checklist_items: items,
        };
      }

      // Overall stats
      const { rows: totalRows } = await client.query('SELECT COUNT(*)::int AS total FROM cs_topics');
      const totalTopics = totalRows[0].total;
      const { rows: completedRows } = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM user_cs_progress WHERE user_id = $1 AND completed = TRUE',
        [userId]
      );
      const completedTopics = completedRows[0].cnt;

      // Learning streak (CS only — independent from DSA streak)
      const streak = await computeCsStreak(client, userId, timeZone);

      // Today's date in user's timezone
      const fmt = (d) => {
        try {
          return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(d);
        } catch {
          return d.toISOString().split('T')[0];
        }
      };
      const todayStr = fmt(new Date());

      // Checklist items checked today (qualifying goal metric)
      const { rows: todayChecklistRows } = await client.query(
        `SELECT COUNT(*)::int AS cnt
         FROM user_cs_study_log
         WHERE user_id = $1
           AND activity = 'checklist_updated'
           AND TO_CHAR(logged_at AT TIME ZONE $2, 'YYYY-MM-DD') = $3`,
        [userId, timeZone, todayStr]
      );
      const checklistItemsToday = todayChecklistRows[0].cnt;

      // CS daily goals from user_settings
      const { rows: settingsRows } = await client.query(
        `SELECT COALESCE(cs_daily_checklist_goal, 3) AS cs_daily_checklist_goal
         FROM user_settings WHERE user_id = $1`,
        [userId]
      );
      const dailyChecklistGoal = settingsRows[0]?.cs_daily_checklist_goal ?? 3;

      // Did user study today?
      const { rows: studiedTodayRows } = await client.query(
        `SELECT COUNT(*)::int AS cnt
         FROM user_cs_study_log
         WHERE user_id = $1
           AND TO_CHAR(logged_at AT TIME ZONE $2, 'YYYY-MM-DD') = $3`,
        [userId, timeZone, todayStr]
      );
      const studiedToday = studiedTodayRows[0].cnt > 0;

      return res.json({
        curriculum_complete: curriculumComplete,
        active_topic: activeTopic,
        today: todayStr,
        timezone: timeZone,
        learning_streak: streak,
        studied_today: studiedToday,
        daily_goals: {
          checklist_goal: dailyChecklistGoal,
          checklist_progress: checklistItemsToday,
          checklist_met: checklistItemsToday >= dailyChecklistGoal,
        },
        overall_stats: {
          total_topics: totalTopics,
          completed_topics: completedTopics,
          remaining_topics: totalTopics - completedTopics,
          completion_percentage: totalTopics > 0
            ? Math.round((completedTopics / totalTopics) * 100)
            : 0,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals daily error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load daily data.' });
  }
});

// ── GET /api/cs-fundamentals/history ─────────────────────────────────────────
// Study history — last 50 distinct activity events with topic & completion info.
router.get('/history', async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();
    try {
      const timeZone = await getCsTimezone(client, userId);

      const { rows } = await client.query(
        `SELECT
           sl.id,
           sl.logged_at,
           sl.activity,
           TO_CHAR(sl.logged_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day,
           t.id   AS topic_id,
           t.title AS topic_title,
           t.global_seq,
           m.title AS module_title,
           COALESCE(ucp.completed, FALSE) AS topic_completed,
           ucp.completed_at
         FROM user_cs_study_log sl
         JOIN cs_topics t ON t.id = sl.topic_id
         JOIN cs_modules m ON m.id = t.module_id
         LEFT JOIN user_cs_progress ucp
           ON ucp.topic_id = t.id AND ucp.user_id = sl.user_id
         WHERE sl.user_id = $1
         ORDER BY sl.logged_at DESC
         LIMIT 100`,
        [userId, timeZone]
      );

      // Group into daily buckets for display
      const byDay = {};
      for (const row of rows) {
        if (!byDay[row.day]) byDay[row.day] = [];
        byDay[row.day].push({
          id: row.id,
          logged_at: row.logged_at,
          activity: row.activity,
          topic_id: row.topic_id,
          topic_title: row.topic_title,
          module_title: row.module_title,
          topic_completed: row.topic_completed,
          completed_at: row.completed_at,
        });
      }

      const days = Object.keys(byDay)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((day) => ({ day, entries: byDay[day] }));

      return res.json({ timezone: timeZone, days });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals history error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load history.' });
  }
});

// ── GET /api/cs-fundamentals/learning-streak ─────────────────────────────────
// CS-only learning streak (completely separate from DSA problem-solving streak).
router.get('/learning-streak', async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();
    try {
      const timeZone = await getCsTimezone(client, userId);
      const streak = await computeCsStreak(client, userId, timeZone);

      // Longest streak ever
      const { rows: allDays } = await client.query(
        `SELECT DISTINCT TO_CHAR(logged_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day
         FROM user_cs_study_log
         WHERE user_id = $1
         ORDER BY day`,
        [userId, timeZone]
      );

      let longestStreak = 0;
      let currentRun = 0;
      let prevDay = null;

      for (const { day } of allDays) {
        if (prevDay) {
          const diff = (new Date(day) - new Date(prevDay)) / 86400000;
          if (diff === 1) {
            currentRun++;
          } else {
            longestStreak = Math.max(longestStreak, currentRun);
            currentRun = 1;
          }
        } else {
          currentRun = 1;
        }
        prevDay = day;
      }
      longestStreak = Math.max(longestStreak, currentRun);

      // Total study days
      const totalStudyDays = allDays.length;

      return res.json({
        current_streak: streak,
        longest_streak: longestStreak,
        total_study_days: totalStudyDays,
        timezone: timeZone,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals learning-streak error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load streak.' });
  }
});

// ── POST /api/cs-fundamentals/study-log ──────────────────────────────────────
// Explicitly record a study activity (e.g., 'started').
// Completion is auto-logged by the /complete endpoint.
// Checklist updates are auto-logged by the checklist endpoint.
router.post('/study-log', async (req, res) => {
  const userId = req.user.id;
  const { topic_id, activity } = req.body;

  const ALLOWED = ['started', 'checklist_updated'];
  if (!topic_id || !Number.isInteger(topic_id)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'topic_id must be an integer.' });
  }
  if (!ALLOWED.includes(activity)) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: `activity must be one of: ${ALLOWED.join(', ')}.`,
    });
  }

  try {
    const client = await pool.connect();
    try {
      const activeSeq = await getActiveTopicSeq(client, userId);

      // Validate topic exists and belongs to active or completed set
      const { rows: topicRows } = await client.query(
        `SELECT t.global_seq,
                COALESCE(ucp.completed, FALSE) AS completed
         FROM cs_topics t
         LEFT JOIN user_cs_progress ucp ON ucp.topic_id = t.id AND ucp.user_id = $1
         WHERE t.id = $2`,
        [userId, topic_id]
      );

      if (topicRows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Topic not found.' });
      }

      const { global_seq, completed } = topicRows[0];
      if (!completed && global_seq !== activeSeq) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You can only log activity on your active or completed topics.',
        });
      }

      await client.query(
        `INSERT INTO user_cs_study_log (user_id, topic_id, activity) VALUES ($1, $2, $3)`,
        [userId, topic_id, activity]
      );

      return res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals study-log error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to log activity.' });
  }
});

// ── GET /api/cs-fundamentals/cs-settings ─────────────────────────────────────
// Retrieve CS-specific user settings.
router.get('/cs-settings', async (req, res) => {
  const userId = req.user.id;
  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT cs_daily_checklist_goal,
                cs_learning_timezone,
                COALESCE(cs_learning_timezone, timezone, 'Asia/Kolkata') AS effective_timezone
         FROM user_settings WHERE user_id = $1`,
        [userId]
      );

      if (rows.length === 0) {
        return res.json({
          cs_daily_checklist_goal: 3,
          cs_learning_timezone: null,
          effective_timezone: 'Asia/Kolkata',
        });
      }

      return res.json(rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals cs-settings GET error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load settings.' });
  }
});

// ── PUT /api/cs-fundamentals/cs-settings ─────────────────────────────────────
// Update CS-specific user settings.
router.put('/cs-settings', async (req, res) => {
  const userId = req.user.id;
  const { cs_daily_checklist_goal, cs_learning_timezone } = req.body;

  const updates = [];
  const values = [userId];

  if (cs_daily_checklist_goal !== undefined) {
    const goal = parseInt(cs_daily_checklist_goal, 10);
    if (isNaN(goal) || goal < 1 || goal > 50) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'cs_daily_checklist_goal must be between 1 and 50.',
      });
    }
    values.push(goal);
    updates.push(`cs_daily_checklist_goal = $${values.length}`);
  }

  if (cs_learning_timezone !== undefined) {
    // Allow null to reset to inherited timezone
    if (cs_learning_timezone !== null && typeof cs_learning_timezone !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'cs_learning_timezone must be an IANA timezone string or null.',
      });
    }
    values.push(cs_learning_timezone);
    updates.push(`cs_learning_timezone = $${values.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No valid fields to update.' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO user_settings (user_id, ${updates.map((u) => u.split(' = ')[0]).join(', ')})
         VALUES ($1, ${updates.map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}`,
        values
      );

      return res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('cs-fundamentals cs-settings PUT error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to save settings.' });
  }
});

// ── ── PLACEMENT & INTERVIEW PREPARATION ROUTES ──────────────────────────────

// ── GET /api/cs-fundamentals/placement/projects ──────────────────────────────
router.get('/placement/projects', async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_interview_projects WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return res.json({ projects: rows });
  } catch (err) {
    console.error('get placement projects error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load projects.' });
  }
});

// ── POST /api/cs-fundamentals/placement/projects ─────────────────────────────
router.post('/placement/projects', async (req, res) => {
  const userId = req.user.id;
  const {
    title, target_users, problem_statement, architecture, tech_stack,
    db_design, key_decisions, tradeoffs, security_notes, performance_notes,
    bugs_resolved, testing_deployment, future_improvements, defense_qa, is_ready
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Project title is required.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_interview_projects (
        user_id, title, target_users, problem_statement, architecture, tech_stack,
        db_design, key_decisions, tradeoffs, security_notes, performance_notes,
        bugs_resolved, testing_deployment, future_improvements, defense_qa, is_ready
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        userId, title.trim(), target_users || '', problem_statement || '', architecture || '', tech_stack || '',
        db_design || '', key_decisions || '', tradeoffs || '', security_notes || '', performance_notes || '',
        bugs_resolved || '', testing_deployment || '', future_improvements || '', JSON.stringify(defense_qa || []),
        Boolean(is_ready)
      ]
    );
    return res.status(201).json({ project: rows[0] });
  } catch (err) {
    console.error('create placement project error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create project.' });
  }
});

// ── PUT /api/cs-fundamentals/placement/projects/:id ──────────────────────────
router.put('/placement/projects/:id', async (req, res) => {
  const userId = req.user.id;
  const projectId = parseInt(req.params.id, 10);
  if (!projectId || isNaN(projectId)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid project id.' });
  }

  const {
    title, target_users, problem_statement, architecture, tech_stack,
    db_design, key_decisions, tradeoffs, security_notes, performance_notes,
    bugs_resolved, testing_deployment, future_improvements, defense_qa, is_ready
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE user_interview_projects SET
        title = COALESCE($1, title),
        target_users = COALESCE($2, target_users),
        problem_statement = COALESCE($3, problem_statement),
        architecture = COALESCE($4, architecture),
        tech_stack = COALESCE($5, tech_stack),
        db_design = COALESCE($6, db_design),
        key_decisions = COALESCE($7, key_decisions),
        tradeoffs = COALESCE($8, tradeoffs),
        security_notes = COALESCE($9, security_notes),
        performance_notes = COALESCE($10, performance_notes),
        bugs_resolved = COALESCE($11, bugs_resolved),
        testing_deployment = COALESCE($12, testing_deployment),
        future_improvements = COALESCE($13, future_improvements),
        defense_qa = COALESCE($14, defense_qa),
        is_ready = COALESCE($15, is_ready),
        updated_at = NOW()
      WHERE id = $16 AND user_id = $17
      RETURNING *`,
      [
        title ? title.trim() : null, target_users, problem_statement, architecture, tech_stack,
        db_design, key_decisions, tradeoffs, security_notes, performance_notes,
        bugs_resolved, testing_deployment, future_improvements,
        defense_qa !== undefined ? JSON.stringify(defense_qa) : null,
        is_ready !== undefined ? Boolean(is_ready) : null,
        projectId, userId
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }
    return res.json({ project: rows[0] });
  } catch (err) {
    console.error('update placement project error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update project.' });
  }
});

// ── DELETE /api/cs-fundamentals/placement/projects/:id ───────────────────────
router.delete('/placement/projects/:id', async (req, res) => {
  const userId = req.user.id;
  const projectId = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM user_interview_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('delete placement project error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete project.' });
  }
});

// ── GET /api/cs-fundamentals/placement/applications ──────────────────────────
router.get('/placement/applications', async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_job_applications WHERE user_id = $1 ORDER BY application_date DESC, updated_at DESC`,
      [userId]
    );
    return res.json({ applications: rows });
  } catch (err) {
    console.error('get placement applications error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load applications.' });
  }
});

// ── POST /api/cs-fundamentals/placement/applications ─────────────────────────
router.post('/placement/applications', async (req, res) => {
  const userId = req.user.id;
  const { company, role, application_date, status, eligibility_notes, interview_date, follow_up_notes, outcome_notes } = req.body;

  if (!company || !company.trim() || !role || !role.trim()) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Company and Role are required.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_job_applications (
        user_id, company, role, application_date, status, eligibility_notes, interview_date, follow_up_notes, outcome_notes
      ) VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), COALESCE($5, 'Applied'), $6, $7, $8, $9)
      RETURNING *`,
      [
        userId, company.trim(), role.trim(), application_date || null, status || 'Applied',
        eligibility_notes || '', interview_date || null, follow_up_notes || '', outcome_notes || ''
      ]
    );
    return res.status(201).json({ application: rows[0] });
  } catch (err) {
    console.error('create placement application error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create application.' });
  }
});

// ── PUT /api/cs-fundamentals/placement/applications/:id ──────────────────────
router.put('/placement/applications/:id', async (req, res) => {
  const userId = req.user.id;
  const appId = parseInt(req.params.id, 10);
  const { company, role, application_date, status, eligibility_notes, interview_date, follow_up_notes, outcome_notes } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE user_job_applications SET
        company = COALESCE($1, company),
        role = COALESCE($2, role),
        application_date = COALESCE($3, application_date),
        status = COALESCE($4, status),
        eligibility_notes = COALESCE($5, eligibility_notes),
        interview_date = COALESCE($6, interview_date),
        follow_up_notes = COALESCE($7, follow_up_notes),
        outcome_notes = COALESCE($8, outcome_notes),
        updated_at = NOW()
      WHERE id = $9 AND user_id = $10
      RETURNING *`,
      [
        company ? company.trim() : null, role ? role.trim() : null, application_date, status,
        eligibility_notes, interview_date, follow_up_notes, outcome_notes, appId, userId
      ]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
    }
    return res.json({ application: rows[0] });
  } catch (err) {
    console.error('update placement application error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update application.' });
  }
});

// ── DELETE /api/cs-fundamentals/placement/applications/:id ───────────────────
router.delete('/placement/applications/:id', async (req, res) => {
  const userId = req.user.id;
  const appId = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM user_job_applications WHERE id = $1 AND user_id = $2',
      [appId, userId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Application not found.' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('delete placement application error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to delete application.' });
  }
});

// ── GET /api/cs-fundamentals/placement/mock-interviews ───────────────────────
router.get('/placement/mock-interviews', async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_mock_interviews WHERE user_id = $1 ORDER BY completed_at DESC`,
      [userId]
    );
    return res.json({ mock_interviews: rows });
  } catch (err) {
    console.error('get mock interviews error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load mock interviews.' });
  }
});

// ── POST /api/cs-fundamentals/placement/mock-interviews ──────────────────────
router.post('/placement/mock-interviews', async (req, res) => {
  const userId = req.user.id;
  const { interview_type, scheduled_at, strengths, weaknesses, communication_rating, technical_rating, feedback, revision_topics, action_items } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_mock_interviews (
        user_id, interview_type, scheduled_at, completed_at, strengths, weaknesses,
        communication_rating, technical_rating, feedback, revision_topics, action_items
      ) VALUES ($1, COALESCE($2, 'dsa'), $3, NOW(), $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId, interview_type || 'dsa', scheduled_at || null, strengths || '', weaknesses || '',
        communication_rating || 3, technical_rating || 3, feedback || '', revision_topics || '', action_items || ''
      ]
    );
    return res.status(201).json({ mock_interview: rows[0] });
  } catch (err) {
    console.error('create mock interview error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to record mock interview.' });
  }
});

// ── GET /api/cs-fundamentals/placement/timed-assessments ─────────────────────
router.get('/placement/timed-assessments', async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM user_timed_assessments WHERE user_id = $1 ORDER BY started_at DESC`,
      [userId]
    );
    return res.json({ timed_assessments: rows });
  } catch (err) {
    console.error('get timed assessments error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load timed assessments.' });
  }
});

// ── POST /api/cs-fundamentals/placement/timed-assessments ────────────────────
router.post('/placement/timed-assessments', async (req, res) => {
  const userId = req.user.id;
  const { title, duration_minutes, score, total_problems, problems_data, performance_summary, feedback } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_timed_assessments (
        user_id, title, duration_minutes, started_at, completed_at, score, total_problems, problems_data, performance_summary, feedback
      ) VALUES ($1, COALESCE($2, 'Timed Coding Assessment'), COALESCE($3, 30), NOW(), NOW(), COALESCE($4, 0), COALESCE($5, 2), $6, $7, $8)
      RETURNING *`,
      [
        userId, title || 'Timed Coding Assessment', duration_minutes || 30, score || 0,
        total_problems || 2, JSON.stringify(problems_data || []), performance_summary || '', feedback || ''
      ]
    );
    return res.status(201).json({ timed_assessment: rows[0] });
  } catch (err) {
    console.error('create timed assessment error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to record timed assessment.' });
  }
});

// ── GET /api/cs-fundamentals/placement/weekly-revision ───────────────────────
router.get('/placement/weekly-revision', async (req, res) => {
  const userId = req.user.id;
  try {
    // 1. Weak DSA problems (Unable to solve or low confidence)
    const { rows: weakProblems } = await pool.query(
      `SELECT id, title, platform, difficulty, solving_status, confidence_level, key_insight, solved_at
       FROM problems
       WHERE user_id = $1 AND (solving_status = 'Unable To Solve' OR confidence_level <= 2)
       ORDER BY solved_at DESC LIMIT 6`,
      [userId]
    );

    // 2. Scheduled spaced repetition due in next 7 days
    const { rows: dueRevisions } = await pool.query(
      `SELECT id, title, difficulty, next_revision_at, solving_status
       FROM problems
       WHERE user_id = $1 AND next_revision_at IS NOT NULL AND next_revision_at <= NOW() + INTERVAL '7 days'
       ORDER BY next_revision_at ASC LIMIT 6`,
      [userId]
    );

    // 3. Failed or weak CS assessments
    const { rows: weakAssessments } = await pool.query(
      `SELECT a.id, a.topic_id, t.title AS topic_title, t.global_seq, a.score, a.passed, a.submitted_at
       FROM user_cs_assessment_attempts a
       JOIN cs_topics t ON t.id = a.topic_id
       WHERE a.user_id = $1 AND a.passed = FALSE
       ORDER BY a.submitted_at DESC LIMIT 6`,
      [userId]
    );

    // 4. Mock interview action items
    const { rows: mockActionItems } = await pool.query(
      `SELECT id, interview_type, revision_topics, action_items, completed_at
       FROM user_mock_interviews
       WHERE user_id = $1 AND (revision_topics != '' OR action_items != '')
       ORDER BY completed_at DESC LIMIT 5`,
      [userId]
    );

    return res.json({
      weak_problems: weakProblems,
      due_revisions: dueRevisions,
      weak_assessments: weakAssessments,
      mock_action_items: mockActionItems,
    });
  } catch (err) {
    console.error('get weekly revision error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to load weekly revision plan.' });
  }
});

export default router;
