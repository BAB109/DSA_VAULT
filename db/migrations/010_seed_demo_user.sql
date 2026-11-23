-- ==============================================================================
-- Migration: 010_seed_demo_user.sql
-- Description: Ensure the default demo user exists in the users table
--              with a valid UUID to allow demo exploration of CS Fundamentals.
-- Engine: PostgreSQL 14+
-- Safe to re-run: uses ON CONFLICT DO NOTHING
-- ==============================================================================

INSERT INTO users (id, username, password_hash)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo',
    '$2b$10$NF4GcPQ5LDyUcaxidbtanehySc2X/UIPC/BKGPmvDkKXbz5Ujf9V.'
)
ON CONFLICT (username) DO NOTHING;
