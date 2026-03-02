-- Notification type enum (subset of activity events that target a specific user)
CREATE TYPE "notification_type" AS ENUM (
  'member_joined',
  'member_removed',
  'member_role_changed',
  'member_assigned',
  'member_unassigned'
);

-- Notifications table
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Primary query: fetch notifications for a user, newest first
CREATE INDEX "notifications_user_created_idx" ON "notifications" ("user_id", "created_at" DESC);

-- For unread count badge
CREATE INDEX "notifications_user_unread_idx" ON "notifications" ("user_id") WHERE "read" = false;

-- For engagement cascade lookups
CREATE INDEX "notifications_engagement_idx" ON "notifications" ("engagement_id");
