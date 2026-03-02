-- Create the finding template category enum
CREATE TYPE "finding_template_category" AS ENUM (
  'web', 'network', 'cloud', 'mobile', 'wireless',
  'social_engineering', 'physical', 'api', 'active_directory',
  'code_review', 'general'
);
--> statement-breakpoint

-- Create the finding_templates table
CREATE TABLE IF NOT EXISTS "finding_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "category" "finding_template_category" DEFAULT 'general' NOT NULL,
  "overview" text NOT NULL,
  "overview_format" varchar(10) DEFAULT 'text' NOT NULL,
  "impact" text,
  "impact_format" varchar(10) DEFAULT 'text' NOT NULL,
  "recommendation" text,
  "recommendation_format" varchar(10) DEFAULT 'text' NOT NULL,
  "severity" "finding_severity" DEFAULT 'medium' NOT NULL,
  "cvss_score" numeric(3,1),
  "cvss_vector" varchar(150),
  "is_system" boolean DEFAULT false NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "finding_templates_category_idx" ON "finding_templates" ("category");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "finding_templates_severity_idx" ON "finding_templates" ("severity");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "finding_templates_title_idx" ON "finding_templates" ("title");
--> statement-breakpoint

-- Create the finding_template_tags join table
CREATE TABLE IF NOT EXISTS "finding_template_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL REFERENCES "finding_templates"("id") ON DELETE CASCADE,
  "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "finding_template_tags_unique_idx"
  ON "finding_template_tags" ("template_id", "tag_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "finding_template_tags_template_idx"
  ON "finding_template_tags" ("template_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "finding_template_tags_tag_idx"
  ON "finding_template_tags" ("tag_id");
