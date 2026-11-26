-- Migration 016: Allow admin_id in admin_audit_log to be NULL for login attempts with unknown usernames
ALTER TABLE admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
