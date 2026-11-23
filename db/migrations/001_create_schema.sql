-- ==============================================================================
-- Migration: 001_create_schema.sql
-- Description: Core schema design for DSA Vault:
--              users, problems, topics, problem_topics, revisions, problem_mistakes
-- Engine: PostgreSQL 14+
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- EXTENSIONS & HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
-- citext provides case-insensitive text type (great for usernames)
CREATE EXTENSION IF NOT EXISTS citext;
-- pgcrypto or uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- TABLE 1: users
-- ------------------------------------------------------------------------------
-- Requirements:
--  * id: primary key (UUID)
--  * username: required and unique (case-insensitive via CITEXT + CHECK)
--  * password_hash: required (Argon2id/Bcrypt hash)
--  * created_at, updated_at: timestamps
--  * No email or mobile required
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username CITEXT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints: enforce username format & length at DB level
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT chk_users_username_format CHECK (
        char_length(username) >= 3 AND
        char_length(username) <= 30 AND
        username ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'
    )
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- ------------------------------------------------------------------------------
-- TABLE 2: problems
-- ------------------------------------------------------------------------------
-- Requirements:
--  * id: primary key
--  * user_id: FK referencing users (ON DELETE CASCADE)
--  * title, platform, problem_url: required
--  * submission_url: nullable
--  * difficulty: required ('Easy', 'Medium', 'Hard')
--  * solving_status: required ('Solved Independently', 'Solved With Hint', 'Solved With Help', 'Unable To Solve')
--  * time_taken_minutes: nullable (positive integer)
--  * solved_at: required (date or timestamptz)
--  * initial_approach, initial_time_complexity, initial_space_complexity: nullable
--  * initial_notes_url: nullable (TEXT, allows NULL)
--  * reviewed_better_solution: boolean default false with clearly defined semantics
--  * improved_approach, improved_time_complexity, improved_space_complexity: nullable
--  * improved_notes_url: nullable (TEXT, allows NULL)
--  * key_insight: nullable
--  * confidence_level: nullable (integer 1..5)
--  * can_solve_independently: nullable (boolean)
--  * next_revision_at: nullable timestamptz
--  * created_at, updated_at: timestamps
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    platform VARCHAR(100) NOT NULL,
    problem_url TEXT NOT NULL,
    submission_url TEXT NULL,
    difficulty VARCHAR(20) NOT NULL,
    solving_status VARCHAR(50) NOT NULL,
    time_taken_minutes INTEGER NULL,
    solved_at DATE NOT NULL,
    
    -- Initial Approach
    initial_approach TEXT NULL,
    initial_time_complexity VARCHAR(100) NULL,
    initial_space_complexity VARCHAR(100) NULL,
    initial_notes_url TEXT NULL,
    main_difficulty TEXT NULL,

    -- Improved Solution (optional before review)
    reviewed_better_solution BOOLEAN NOT NULL DEFAULT FALSE,
    improved_approach TEXT NULL,
    improved_time_complexity VARCHAR(100) NULL,
    improved_space_complexity VARCHAR(100) NULL,
    improved_notes_url TEXT NULL,
    key_insight TEXT NULL,

    -- Self-Assessment
    confidence_level SMALLINT NULL,
    can_solve_independently BOOLEAN NULL,
    next_revision_at DATE NULL,

    -- Auditing
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_problems_difficulty CHECK (
        difficulty IN ('Easy', 'Medium', 'Hard')
    ),
    CONSTRAINT chk_problems_solving_status CHECK (
        solving_status IN (
            'Solved Independently',
            'Solved With Hint',
            'Solved With Help',
            'Unable To Solve'
        )
    ),
    CONSTRAINT chk_problems_confidence_level CHECK (
        confidence_level IS NULL OR (confidence_level >= 1 AND confidence_level <= 5)
    ),
    CONSTRAINT chk_problems_time_taken CHECK (
        time_taken_minutes IS NULL OR time_taken_minutes > 0
    ),
    CONSTRAINT chk_problems_initial_notes_url CHECK (
        initial_notes_url IS NULL OR initial_notes_url ~* '^https:\/\/(drive|docs)\.google\.com\/'
    ),
    CONSTRAINT chk_problems_improved_notes_url CHECK (
        improved_notes_url IS NULL OR improved_notes_url ~* '^https:\/\/(drive|docs)\.google\.com\/'
    )
);

CREATE TRIGGER trg_problems_updated_at
BEFORE UPDATE ON problems
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems (user_id);
CREATE INDEX IF NOT EXISTS idx_problems_user_solved_at ON problems (user_id, solved_at DESC);
CREATE INDEX IF NOT EXISTS idx_problems_user_difficulty ON problems (user_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_user_next_revision ON problems (user_id, next_revision_at)
    WHERE next_revision_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_problems_user_status ON problems (user_id, solving_status);

-- ------------------------------------------------------------------------------
-- TABLE 3: topics
-- ------------------------------------------------------------------------------
-- Requirements:
--  * id: primary key (SERIAL or INT)
--  * name: required and unique
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    name CITEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_topics_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_topics_name ON topics (name);

-- ------------------------------------------------------------------------------
-- TABLE 4: problem_topics (Many-to-Many junction)
-- ------------------------------------------------------------------------------
-- Requirements:
--  * problem_id: FK referencing problems (ON DELETE CASCADE)
--  * topic_id: FK referencing topics (ON DELETE RESTRICT/CASCADE)
--  * Composite primary key on (problem_id, topic_id)
--  * Prevents duplicate topic assignments per problem
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problem_topics (
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (problem_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_topics_topic_id ON problem_topics (topic_id);

-- ------------------------------------------------------------------------------
-- TABLE 5: revisions (Revision Center History & Schedule)
-- ------------------------------------------------------------------------------
-- Requirements:
--  * id: primary key (UUID)
--  * problem_id: foreign key referencing problems (ON DELETE CASCADE)
--  * scheduled_at: required timestamp
--  * completed_at: nullable timestamp
--  * result: nullable until completed ('Remembered', 'Partially Remembered', 'Forgot')
--  * notes: nullable
--  * next_revision_at: nullable timestamp
--  * created_at: timestamp
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NULL,
    result VARCHAR(50) NULL,
    notes TEXT NULL,
    next_revision_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_revisions_result CHECK (
        result IS NULL OR result IN ('Remembered', 'Partially Remembered', 'Forgot')
    ),
    CONSTRAINT chk_revisions_completed_consistency CHECK (
        (completed_at IS NULL AND result IS NULL) OR
        (completed_at IS NOT NULL AND result IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_revisions_problem_id ON revisions (problem_id);
CREATE INDEX IF NOT EXISTS idx_revisions_scheduled_at ON revisions (scheduled_at)
    WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_revisions_completed_at ON revisions (completed_at DESC)
    WHERE completed_at IS NOT NULL;

-- ------------------------------------------------------------------------------
-- TABLE 6: problem_mistakes
-- ------------------------------------------------------------------------------
-- Requirements:
--  * problem_id: FK referencing problems (ON DELETE CASCADE)
--  * mistake_category: required (VARCHAR)
--  * Composite primary key on (problem_id, mistake_category)
--  * Prevents duplicate mistake categories for the same problem
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS problem_mistakes (
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    mistake_category VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (problem_id, mistake_category),

    CONSTRAINT chk_problem_mistakes_category CHECK (
        mistake_category IN (
            'Off-by-one error',
            'Wrong algorithm',
            'Couldn''t code it',
            'TLE',
            'Wrong complexity analysis',
            'Pointer confusion',
            'Forgot base case',
            'Edge case missed',
            'Other'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_problem_mistakes_category ON problem_mistakes (mistake_category);
