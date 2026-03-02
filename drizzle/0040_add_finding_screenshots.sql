CREATE TABLE IF NOT EXISTS "finding_screenshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "finding_id" uuid NOT NULL REFERENCES "category_findings"("id") ON DELETE CASCADE,
  "disk_path" varchar(500) NOT NULL,
  "original_filename" varchar(500) NOT NULL,
  "mime_type" varchar(255) NOT NULL,
  "file_size" bigint NOT NULL,
  "caption" varchar(500),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "finding_screenshots_finding_idx" ON "finding_screenshots" ("finding_id");
