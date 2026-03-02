-- Report format enum
CREATE TYPE "report_format" AS ENUM ('pdf', 'docx');

-- Report status enum
CREATE TYPE "report_status" AS ENUM ('pending', 'generating', 'completed', 'failed');

-- Saved report configurations per engagement
CREATE TABLE "report_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "template_type" varchar(50) NOT NULL,
  "sections" jsonb NOT NULL DEFAULT '[]',
  "filters" jsonb NOT NULL DEFAULT '{}',
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "report_configs_engagement_idx" ON "report_configs" ("engagement_id");

-- Generated report file records
CREATE TABLE "generated_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "config_id" uuid NOT NULL REFERENCES "report_configs"("id") ON DELETE CASCADE,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "format" "report_format" NOT NULL,
  "status" "report_status" NOT NULL DEFAULT 'pending',
  "disk_path" varchar(500),
  "file_size" integer,
  "error_message" text,
  "generated_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "generated_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "generated_reports_config_idx" ON "generated_reports" ("config_id");
CREATE INDEX "generated_reports_engagement_idx" ON "generated_reports" ("engagement_id");
