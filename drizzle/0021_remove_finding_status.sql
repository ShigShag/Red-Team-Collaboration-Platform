-- Remove status column from category_findings
ALTER TABLE "category_findings" DROP COLUMN "status";

-- Drop finding_status enum type
DROP TYPE "finding_status";

-- Remove finding_status_changed from activity_event_type enum
-- Note: PostgreSQL does not support removing values from an enum.
-- The unused value will remain in the enum but won't be used by any new code.
