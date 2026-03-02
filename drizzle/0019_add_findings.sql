-- Findings: standalone vulnerability findings within categories

-- Create enums
CREATE TYPE "public"."finding_status" AS ENUM(
  'draft',
  'confirmed',
  'remediated',
  'accepted_risk'
);
--> statement-breakpoint

CREATE TYPE "public"."finding_severity" AS ENUM(
  'critical',
  'high',
  'medium',
  'low',
  'info'
);
--> statement-breakpoint

-- Main findings table
CREATE TABLE "category_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "overview" text NOT NULL,
  "overview_format" varchar(10) NOT NULL DEFAULT 'text',
  "impact" text,
  "impact_format" varchar(10) NOT NULL DEFAULT 'text',
  "recommendation" text,
  "recommendation_format" varchar(10) NOT NULL DEFAULT 'text',
  "status" "finding_status" NOT NULL DEFAULT 'draft',
  "severity" "finding_severity" NOT NULL DEFAULT 'medium',
  "cvss_score" numeric(3,1),
  "cvss_vector" varchar(100),
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Finding <-> Resource junction (M:N)
CREATE TABLE "finding_resources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "finding_id" uuid NOT NULL,
  "resource_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Finding <-> Tag junction (M:N)
CREATE TABLE "finding_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "finding_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Foreign keys for category_findings
ALTER TABLE "category_findings"
  ADD CONSTRAINT "category_findings_category_id_engagement_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."engagement_categories"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "category_findings"
  ADD CONSTRAINT "category_findings_created_by_users_id_fk"
  FOREIGN KEY ("created_by")
  REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Foreign keys for finding_resources
ALTER TABLE "finding_resources"
  ADD CONSTRAINT "finding_resources_finding_id_category_findings_id_fk"
  FOREIGN KEY ("finding_id")
  REFERENCES "public"."category_findings"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "finding_resources"
  ADD CONSTRAINT "finding_resources_resource_id_resources_id_fk"
  FOREIGN KEY ("resource_id")
  REFERENCES "public"."resources"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Foreign keys for finding_tags
ALTER TABLE "finding_tags"
  ADD CONSTRAINT "finding_tags_finding_id_category_findings_id_fk"
  FOREIGN KEY ("finding_id")
  REFERENCES "public"."category_findings"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "finding_tags"
  ADD CONSTRAINT "finding_tags_tag_id_tags_id_fk"
  FOREIGN KEY ("tag_id")
  REFERENCES "public"."tags"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Indexes for category_findings
CREATE INDEX "category_findings_category_idx"
  ON "category_findings" USING btree ("category_id");
--> statement-breakpoint

-- Indexes for finding_resources
CREATE UNIQUE INDEX "finding_resources_unique_idx"
  ON "finding_resources" USING btree ("finding_id", "resource_id");
--> statement-breakpoint
CREATE INDEX "finding_resources_finding_idx"
  ON "finding_resources" USING btree ("finding_id");
--> statement-breakpoint
CREATE INDEX "finding_resources_resource_idx"
  ON "finding_resources" USING btree ("resource_id");
--> statement-breakpoint

-- Indexes for finding_tags
CREATE UNIQUE INDEX "finding_tags_unique_idx"
  ON "finding_tags" USING btree ("finding_id", "tag_id");
--> statement-breakpoint
CREATE INDEX "finding_tags_finding_idx"
  ON "finding_tags" USING btree ("finding_id");
--> statement-breakpoint
CREATE INDEX "finding_tags_tag_idx"
  ON "finding_tags" USING btree ("tag_id");
--> statement-breakpoint

-- Add finding activity event types
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'finding_created';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'finding_updated';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'finding_deleted';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'finding_status_changed';
