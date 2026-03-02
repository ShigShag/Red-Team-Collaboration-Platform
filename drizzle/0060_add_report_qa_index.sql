-- Create partial index on QA comments now that the 'report_section' enum value is committed.
-- This must run in a separate transaction from the ALTER TYPE ADD VALUE statement in 0059.
CREATE INDEX IF NOT EXISTS "comments_report_qa_idx" ON "comments" ("target_id", "qa_status")
  WHERE "target_type" = 'report_section';
