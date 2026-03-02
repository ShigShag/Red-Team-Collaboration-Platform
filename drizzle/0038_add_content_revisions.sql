-- Content Revisions (edit history for findings and actions)
-- Captures full entity snapshot before each update

-- New enum for revision entity types
CREATE TYPE "revision_entity_type" AS ENUM ('finding', 'action');

-- Content revisions table
CREATE TABLE "content_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" "revision_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "revision_number" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "changed_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "change_summary" text,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Index for efficient entity history lookups
CREATE INDEX "content_revisions_entity_idx" ON "content_revisions" ("entity_type", "entity_id", "revision_number");
