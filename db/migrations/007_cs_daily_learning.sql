-- =============================================================================
-- Migration 007: CS Daily Learning Experience
-- Adds study activity log, CS-specific settings columns, and supporting indexes.
-- Safe to re-run: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Study activity log
--    Records every qualifying study event for a user on a CS topic.
--    Used for: daily history display, streak calculation, daily-goal tracking.
--    Qualifying activities: 'started', 'checklist_updated', 'completed'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_cs_study_log (
    id          SERIAL PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic_id    INTEGER     NOT NULL REFERENCES cs_topics(id) ON DELETE CASCADE,
    activity    VARCHAR(50) NOT NULL CHECK (activity IN ('started', 'checklist_updated', 'completed')),
    logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_study_log_user_date
    ON user_cs_study_log (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_cs_study_log_user_topic
    ON user_cs_study_log (user_id, topic_id, logged_at DESC);

-- ---------------------------------------------------------------------------
-- 2. CS-specific user settings columns
--    Extend the existing user_settings table without altering other columns.
--    cs_daily_checklist_goal : target checked items per day (default 3)
--    cs_learning_timezone    : IANA timezone override for CS streak/history
--                              NULL means "inherit from settings.timezone"
-- ---------------------------------------------------------------------------
ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS cs_daily_checklist_goal INTEGER      NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS cs_learning_timezone     VARCHAR(100)     NULL;
