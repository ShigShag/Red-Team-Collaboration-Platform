-- Add chat_message_role enum
CREATE TYPE "chat_message_role" AS ENUM ('user', 'assistant', 'system');

-- Add ai_chat_message to activity event type enum
ALTER TYPE "activity_event_type" ADD VALUE 'ai_chat_message';

-- Chat sessions (per-engagement AI chat conversations)
CREATE TABLE "chat_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "chat_sessions_engagement_user_idx" ON "chat_sessions" ("engagement_id", "user_id");
CREATE INDEX "chat_sessions_user_idx" ON "chat_sessions" ("user_id");

-- Chat messages (individual messages within a session)
CREATE TABLE "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
  "role" "chat_message_role" NOT NULL,
  "content" text NOT NULL,
  "tool_calls" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "chat_messages_session_idx" ON "chat_messages" ("session_id", "created_at");
