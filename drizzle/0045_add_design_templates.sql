-- Design Templates for Reports
CREATE TABLE IF NOT EXISTS "design_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "theme" jsonb NOT NULL,
  "logo_disk_path" varchar(500),
  "logo_filename" varchar(500),
  "logo_mime_type" varchar(100),
  "logo_width" integer,
  "logo_height" integer,
  "logo_position" varchar(20),
  "is_system" boolean NOT NULL DEFAULT false,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "design_templates_created_by_idx" ON "design_templates" ("created_by");

-- Add design_template_id to report_configs
ALTER TABLE "report_configs"
  ADD COLUMN "design_template_id" uuid REFERENCES "design_templates"("id") ON DELETE SET NULL;

-- Seed system default template
INSERT INTO "design_templates" ("name", "description", "theme", "is_system", "is_default")
VALUES (
  'Default',
  'Built-in dark cover with coral accent',
  '{
    "colors": {
      "primary": "#0d1117",
      "surface": "#161b24",
      "accent": "#e8735a",
      "textPrimary": "#1a1a1a",
      "textSecondary": "#4a5568",
      "textMuted": "#718096",
      "border": "#e2e8f0",
      "white": "#ffffff",
      "tableHeaderBg": "#f7f8fa",
      "codeBg": "#f5f5f5",
      "tagBg": "#f0f0f0",
      "linkColor": "#2563eb"
    },
    "fonts": {
      "heading": "DM Sans",
      "body": "DM Sans",
      "mono": "JetBrains Mono"
    },
    "pdfFonts": {
      "heading": "Helvetica",
      "body": "Helvetica",
      "mono": "Courier"
    },
    "layout": {
      "coverStyle": "dark",
      "pageMarginTop": 60,
      "pageMarginBottom": 60,
      "pageMarginHorizontal": 50
    }
  }'::jsonb,
  true,
  true
);
