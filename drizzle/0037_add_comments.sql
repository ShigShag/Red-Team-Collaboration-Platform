-- Comments & Discussion Threads
-- Polymorphic comments on findings, actions, and resources with single-level threading

-- New enum for comment target types
CREATE TYPE "comment_target_type" AS ENUM ('finding', 'action', 'resource');

-- Comments table
CREATE TABLE "comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "target_type" "comment_target_type" NOT NULL,
  "target_id" uuid NOT NULL,
  "parent_id" uuid REFERENCES "comments"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "content_format" varchar(10) NOT NULL DEFAULT 'markdown',
  "edited_at" timestamptz,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX "comments_target_idx" ON "comments" ("target_type", "target_id", "created_at");
CREATE INDEX "comments_engagement_idx" ON "comments" ("engagement_id");
CREATE INDEX "comments_parent_idx" ON "comments" ("parent_id");
CREATE INDEX "comments_author_idx" ON "comments" ("author_id");

-- Extend notification_type enum
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'comment_mention';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'comment_reply';

-- Extend activity_event_type enum
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'comment_created';
