-- ==============================================================================
-- Migration: 004_add_timezone_to_settings.sql
-- Description: Adds timezone preference to user_settings table
-- ==============================================================================

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NOT NULL DEFAULT 'UTC';
