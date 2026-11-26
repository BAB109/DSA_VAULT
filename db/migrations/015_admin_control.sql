-- 015_admin_control.sql
-- Admin control center additions:
-- 1. Tracker status (active / archived)
-- 2. admin_audit_log table (no FK on tracker_id so it survives tracker deletion)

ALTER TABLE trackers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'));

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  tracker_id UUID NULL,
  details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_tracker ON admin_audit_log (tracker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trackers_status ON trackers (status);
