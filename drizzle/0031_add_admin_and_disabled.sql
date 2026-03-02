-- Add admin flag, disabled status, and force password reset to users
ALTER TABLE "users" ADD COLUMN "is_admin" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamptz;
ALTER TABLE "users" ADD COLUMN "password_reset_required" boolean NOT NULL DEFAULT false;

-- Add admin-related security event types (each ADD VALUE must be a separate statement)
ALTER TYPE "security_event_type" ADD VALUE 'admin_user_disabled';
ALTER TYPE "security_event_type" ADD VALUE 'admin_user_enabled';
ALTER TYPE "security_event_type" ADD VALUE 'admin_user_deleted';
ALTER TYPE "security_event_type" ADD VALUE 'admin_force_password_reset';
ALTER TYPE "security_event_type" ADD VALUE 'admin_grant_admin';
ALTER TYPE "security_event_type" ADD VALUE 'admin_revoke_admin';
ALTER TYPE "security_event_type" ADD VALUE 'admin_settings_changed';
