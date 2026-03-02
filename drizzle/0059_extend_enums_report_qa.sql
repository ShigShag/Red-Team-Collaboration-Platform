-- Extend comment_target_type enum to support report section comments
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PostgreSQL
ALTER TYPE "comment_target_type" ADD VALUE IF NOT EXISTS 'report_section';

-- Add QA tracking columns to report_configs
ALTER TABLE "report_configs"
  ADD COLUMN "qa_requested_at" timestamptz,
  ADD COLUMN "qa_signed_off_at" timestamptz,
  ADD COLUMN "qa_signed_off_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Extend notification_type enum with QA notification types
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'report_qa_requested';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'report_qa_comment';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'report_qa_signed_off';

-- Extend activity_event_type enum with QA event types
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'report_qa_requested';
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'report_qa_comment';
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'report_qa_resolved';
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'report_qa_signed_off';

-- Note: the partial index on target_type = 'report_section' is created in migration 0060
-- because PostgreSQL requires the enum value to be committed before it can be used in an index predicate.
