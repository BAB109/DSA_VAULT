-- ==============================================================================
-- Migration: 005_add_daily_revision_goal.sql
-- Description: Adds daily_revision_goal to user_settings table
-- ==============================================================================

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS daily_revision_goal INTEGER NOT NULL DEFAULT 2;
