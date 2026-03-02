-- Add coordinator role columns and exclusion table

ALTER TABLE "users" ADD COLUMN "is_coordinator" boolean NOT NULL DEFAULT false;

ALTER TABLE "engagements" ADD COLUMN "exclude_coordinators" boolean NOT NULL DEFAULT false;

-- Add coordinator security event types
ALTER TYPE "security_event_type" ADD VALUE IF NOT EXISTS 'admin_grant_coordinator';
ALTER TYPE "security_event_type" ADD VALUE IF NOT EXISTS 'admin_revoke_coordinator';

CREATE TABLE "coordinator_exclusions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "coordinator_exclusions_unique_idx" ON "coordinator_exclusions" ("engagement_id", "user_id");
CREATE INDEX "coordinator_exclusions_user_idx" ON "coordinator_exclusions" ("user_id");
