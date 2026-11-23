-- ==============================================================================
-- Migration: 003_update_revisions_and_settings.sql
-- Description:
-- 1. Updates check constraint on revisions table to support the 4 required outcomes:
--    - 'Solved Independently'
--    - 'Solved With Hint'
--    - 'Reviewed The Solution'
--    - 'Unable To Solve'
--    (while maintaining backward compatibility with legacy values)
-- 2. Creates user_settings table to persist custom revision intervals per user.
-- ==============================================================================

-- Drop old check constraint on revisions.result
ALTER TABLE revisions DROP CONSTRAINT IF EXISTS chk_revisions_result;

-- Add updated check constraint with the 4 core outcomes + legacy fallbacks
ALTER TABLE revisions ADD CONSTRAINT chk_revisions_result CHECK (
    result IS NULL OR result IN (
        'Solved Independently',
        'Solved With Hint',
        'Reviewed The Solution',
        'Unable To Solve',
        'Remembered',
        'Partially Remembered',
        'Forgot'
    )
);

-- User settings table for custom intervals and periodic policies
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    interval_stage_1 INTEGER NOT NULL DEFAULT 1,
    interval_stage_2 INTEGER NOT NULL DEFAULT 3,
    interval_stage_3 INTEGER NOT NULL DEFAULT 7,
    interval_stage_4 INTEGER NOT NULL DEFAULT 14,
    interval_stage_5 INTEGER NOT NULL DEFAULT 30,
    periodic_interval INTEGER NOT NULL DEFAULT 30,
    daily_problem_goal INTEGER NOT NULL DEFAULT 3,
    weekly_problem_goal INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
