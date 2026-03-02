-- Engagement Lifecycle Management: add status column with phase tracking

CREATE TYPE "public"."engagement_status" AS ENUM(
  'scoping',
  'active',
  'reporting',
  'closed',
  'archived'
);
--> statement-breakpoint

ALTER TABLE "engagements"
  ADD COLUMN "status" "engagement_status" NOT NULL DEFAULT 'scoping';
--> statement-breakpoint

-- Auto-set existing engagements based on their dates
UPDATE "engagements"
  SET "status" = 'closed'
  WHERE "end_date" IS NOT NULL AND "end_date" < CURRENT_DATE;
--> statement-breakpoint

UPDATE "engagements"
  SET "status" = 'active'
  WHERE "start_date" IS NOT NULL
    AND "start_date" <= CURRENT_DATE
    AND ("end_date" IS NULL OR "end_date" >= CURRENT_DATE);
--> statement-breakpoint

ALTER TYPE "activity_event_type" ADD VALUE 'engagement_status_changed';
--> statement-breakpoint

ALTER TYPE "notification_type" ADD VALUE 'engagement_status_changed';
--> statement-breakpoint

CREATE INDEX "engagements_status_idx" ON "engagements" USING btree ("status");
