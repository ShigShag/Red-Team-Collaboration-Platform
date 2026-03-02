-- Add QA review columns to comments table
-- These columns are nullable and only populated when target_type = 'report_section'

ALTER TABLE "comments"
  ADD COLUMN "qa_status" varchar(20) CHECK ("qa_status" IN ('open', 'resolved', 'approved')),
  ADD COLUMN "section_key" varchar(100),
  ADD COLUMN "field_path" varchar(255),
  ADD COLUMN "qa_resolved_at" timestamptz,
  ADD COLUMN "qa_resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "qa_approved_at" timestamptz,
  ADD COLUMN "qa_approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Note: The partial index on target_type = 'report_section' is created in the next migration
-- (0059) after the enum value is added, since PostgreSQL validates the predicate immediately.
