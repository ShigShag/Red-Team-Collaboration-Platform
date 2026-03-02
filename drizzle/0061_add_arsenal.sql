-- Arsenal: Global Tools & Tactics

-- Enums
CREATE TYPE "public"."arsenal_tool_category" AS ENUM(
  'reconnaissance', 'scanning', 'exploitation', 'post_exploitation',
  'privilege_escalation', 'credential_access', 'lateral_movement',
  'persistence', 'exfiltration', 'command_and_control', 'defense_evasion',
  'reporting', 'utility', 'general'
);

CREATE TYPE "public"."arsenal_tactic_category" AS ENUM(
  'initial_access', 'execution', 'persistence', 'privilege_escalation',
  'defense_evasion', 'credential_access', 'discovery', 'lateral_movement',
  'collection', 'exfiltration', 'command_and_control', 'impact', 'general'
);

-- Arsenal Tools
CREATE TABLE "arsenal_tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "url" varchar(2048),
  "category" "arsenal_tool_category" DEFAULT 'general' NOT NULL,
  "notes" text,
  "notes_format" varchar(10) DEFAULT 'text' NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "arsenal_tools_category_idx" ON "arsenal_tools" USING btree ("category");
CREATE INDEX "arsenal_tools_name_idx" ON "arsenal_tools" USING btree ("name");
CREATE INDEX "arsenal_tools_created_by_idx" ON "arsenal_tools" USING btree ("created_by");

-- Arsenal Tactics
CREATE TABLE "arsenal_tactics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "content" text,
  "content_format" varchar(10) DEFAULT 'text' NOT NULL,
  "category" "arsenal_tactic_category" DEFAULT 'general' NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "arsenal_tactics_category_idx" ON "arsenal_tactics" USING btree ("category");
CREATE INDEX "arsenal_tactics_name_idx" ON "arsenal_tactics" USING btree ("name");
CREATE INDEX "arsenal_tactics_created_by_idx" ON "arsenal_tactics" USING btree ("created_by");

-- Arsenal Tactic ↔ Tag junction (MITRE ATT&CK tags)
CREATE TABLE "arsenal_tactic_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tactic_id" uuid NOT NULL REFERENCES "arsenal_tactics"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "arsenal_tactic_tags_unique_idx" ON "arsenal_tactic_tags" USING btree ("tactic_id", "tag_id");
CREATE INDEX "arsenal_tactic_tags_tactic_idx" ON "arsenal_tactic_tags" USING btree ("tactic_id");
CREATE INDEX "arsenal_tactic_tags_tag_idx" ON "arsenal_tactic_tags" USING btree ("tag_id");

-- Arsenal Tool ↔ Tactic junction
CREATE TABLE "arsenal_tool_tactics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tool_id" uuid NOT NULL REFERENCES "arsenal_tools"("id") ON DELETE CASCADE,
  "tactic_id" uuid NOT NULL REFERENCES "arsenal_tactics"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "arsenal_tool_tactics_unique_idx" ON "arsenal_tool_tactics" USING btree ("tool_id", "tactic_id");
CREATE INDEX "arsenal_tool_tactics_tool_idx" ON "arsenal_tool_tactics" USING btree ("tool_id");
CREATE INDEX "arsenal_tool_tactics_tactic_idx" ON "arsenal_tool_tactics" USING btree ("tactic_id");

-- URL Preview Cache
CREATE TABLE "url_preview_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "url" varchar(2048) NOT NULL UNIQUE,
  "type" varchar(20) NOT NULL,
  "title" varchar(500),
  "description" text,
  "image_url" varchar(2048),
  "github_stars" integer,
  "github_language" varchar(100),
  "github_topics" jsonb,
  "github_full_name" varchar(255),
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

CREATE INDEX "url_preview_cache_expires_idx" ON "url_preview_cache" USING btree ("expires_at");
