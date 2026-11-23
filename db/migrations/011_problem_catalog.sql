-- Migration 011: LeetCode Problem Catalog
-- Adds catalog_problems table, index on LOWER(title), and references it in problems table

CREATE TABLE IF NOT EXISTS catalog_problems (
    id SERIAL PRIMARY KEY,
    lc_number INT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')) NULL,
    topic_tags TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_problems_lower_title ON catalog_problems (LOWER(title));

ALTER TABLE problems ADD COLUMN IF NOT EXISTS catalog_id INT REFERENCES catalog_problems(id);
