-- Migration 012: Trackers schema
-- Multi-user shared trackers with admin approval, daily assignments, sheet items, and submissions

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    public_code VARCHAR(16) UNIQUE NOT NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    per_day INT NOT NULL CHECK (per_day >= 1 AND per_day <= 10),
    start_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracker_members (
    tracker_id UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tracker_id, user_id)
);

CREATE TABLE IF NOT EXISTS tracker_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracker_id UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_by UUID NULL REFERENCES users(id),
    decided_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracker_join_requests_pending
    ON tracker_join_requests (tracker_id, user_id)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS tracker_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracker_id UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INT NOT NULL DEFAULT 10,
    use_count INT NOT NULL DEFAULT 0,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracker_sheet_items (
    tracker_id UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    catalog_id INT NOT NULL REFERENCES catalog_problems(id) ON DELETE CASCADE,
    position INT NOT NULL,
    PRIMARY KEY (tracker_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_tracker_sheet_items_pos
    ON tracker_sheet_items (tracker_id, position);

CREATE TABLE IF NOT EXISTS tracker_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracker_id UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    assign_date DATE NOT NULL,
    catalog_id INT NOT NULL REFERENCES catalog_problems(id) ON DELETE CASCADE,
    UNIQUE (tracker_id, assign_date, catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_tracker_assignments_date
    ON tracker_assignments (tracker_id, assign_date);

CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES tracker_assignments(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_taken INT NULL,
    solution_url TEXT NOT NULL,
    notes TEXT NULL,
    problem_id UUID NULL REFERENCES problems(id) ON DELETE SET NULL,
    UNIQUE (user_id, assignment_id)
);
