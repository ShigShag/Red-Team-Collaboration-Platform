-- Security event types for audit logging
CREATE TYPE "security_event_type" AS ENUM (
  'user_registered',
  'login_success',
  'login_failed',
  'totp_login_success',
  'totp_invalid_code',
  'totp_decryption_failed',
  'totp_enabled',
  'totp_enable_password_failed',
  'password_changed',
  'password_change_failed',
  'password_change_totp_failed',
  'password_change_decrypt_failed',
  'account_deleted',
  'account_delete_failed'
);

-- Security events table (persists after user deletion via SET NULL)
CREATE TABLE "security_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type" "security_event_type" NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "username" varchar(100),
  "ip_address" varchar(45),
  "user_agent" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Query by event type (e.g. all login failures)
CREATE INDEX "security_events_type_idx" ON "security_events" ("event_type");

-- Query by user (e.g. all events for a specific user)
CREATE INDEX "security_events_user_idx" ON "security_events" ("user_id");

-- Query by time (e.g. recent events)
CREATE INDEX "security_events_created_idx" ON "security_events" ("created_at" DESC);

-- Query by IP (e.g. brute force detection)
CREATE INDEX "security_events_ip_idx" ON "security_events" ("ip_address");
