-- ==============================================================================
-- Migration: 014_drop_cs_modules.sql
-- Description: Drop all CS Fundamentals and Placement modules to focus product
--              strictly on DSA tracking.
-- ==============================================================================

-- Drop CS Assessment & Progress tables (child tables first, with CASCADE for safety)
DROP TABLE IF EXISTS user_cs_assessment_answers CASCADE;
DROP TABLE IF EXISTS user_cs_assessment_attempts CASCADE;
DROP TABLE IF EXISTS cs_assessment_questions CASCADE;
DROP TABLE IF EXISTS cs_topic_assessment_config CASCADE;
DROP TABLE IF EXISTS user_cs_checklist_progress CASCADE;
DROP TABLE IF EXISTS cs_topic_checklist_items CASCADE;
DROP TABLE IF EXISTS user_cs_study_log CASCADE;
DROP TABLE IF EXISTS user_cs_progress CASCADE;
DROP TABLE IF EXISTS cs_topic_prerequisites CASCADE;
DROP TABLE IF EXISTS cs_topics CASCADE;
DROP TABLE IF EXISTS cs_sections CASCADE;
DROP TABLE IF EXISTS cs_modules CASCADE;

-- Drop Placement tables
DROP TABLE IF EXISTS user_interview_projects CASCADE;
DROP TABLE IF EXISTS user_job_applications CASCADE;
DROP TABLE IF EXISTS user_mock_interviews CASCADE;
DROP TABLE IF EXISTS user_timed_assessments CASCADE;

-- Drop CS-specific columns from user_settings if present
ALTER TABLE user_settings
    DROP COLUMN IF EXISTS cs_daily_checklist_goal,
    DROP COLUMN IF EXISTS cs_learning_timezone;
