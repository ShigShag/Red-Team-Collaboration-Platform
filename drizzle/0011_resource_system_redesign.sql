-- Resource System Redesign: dynamic resources with templates, fields, and encrypted files
-- Replaces the rigid category_resources table with a flexible 3-table design

-- 1. Drop old tables (action_resources depends on category_resources)
DROP TABLE IF EXISTS "action_resources" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "category_resources" CASCADE;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."resource_type";
--> statement-breakpoint

-- 2. Create field_type enum
CREATE TYPE "public"."field_type" AS ENUM('text', 'secret', 'url', 'code');
--> statement-breakpoint

-- 3. Create resource_templates table
CREATE TABLE "resource_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"color" varchar(7),
	"description" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_templates" ADD CONSTRAINT "resource_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- 4. Create resources table
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"template_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_category_id_engagement_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."engagement_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_template_id_resource_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."resource_templates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "resources_category_idx" ON "resources" USING btree ("category_id");
--> statement-breakpoint

-- 5. Create resource_fields table
CREATE TABLE "resource_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(150) NOT NULL,
	"type" "field_type" NOT NULL,
	"value" text,
	"encrypted_value" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_fields" ADD CONSTRAINT "resource_fields_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "resource_fields_resource_idx" ON "resource_fields" USING btree ("resource_id");
--> statement-breakpoint

-- 6. Create resource_files table
CREATE TABLE "resource_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"disk_path" varchar(500) NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "resource_files_resource_idx" ON "resource_files" USING btree ("resource_id");
--> statement-breakpoint

-- 7. Recreate action_resources junction table (now referencing resources)
CREATE TABLE "action_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_resources" ADD CONSTRAINT "action_resources_action_id_category_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."category_actions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "action_resources" ADD CONSTRAINT "action_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "action_resources_unique_idx" ON "action_resources" USING btree ("action_id","resource_id");
--> statement-breakpoint
CREATE INDEX "action_resources_action_idx" ON "action_resources" USING btree ("action_id");
--> statement-breakpoint
CREATE INDEX "action_resources_resource_idx" ON "action_resources" USING btree ("resource_id");
--> statement-breakpoint

-- 8. Seed system resource templates
INSERT INTO "resource_templates" ("name", "icon", "description", "fields", "is_system") VALUES
  ('Credential', '🔑', 'Usernames, passwords, hashes, tokens', '[{"key":"username","label":"Username","type":"text","required":true},{"key":"password","label":"Password","type":"secret","required":false},{"key":"hash","label":"Hash","type":"secret","required":false},{"key":"domain","label":"Domain","type":"text","required":false},{"key":"target","label":"Target","type":"text","required":false},{"key":"notes","label":"Notes","type":"text","required":false}]'::jsonb, true),
  ('Screenshot', '📸', 'Screenshots and photos', '[{"key":"description","label":"Description","type":"text","required":false}]'::jsonb, true),
  ('Scan Output', '🖥️', 'Nmap, Nessus, Burp Suite exports', '[{"key":"tool","label":"Tool","type":"text","required":false},{"key":"command","label":"Command","type":"code","required":false},{"key":"notes","label":"Notes","type":"text","required":false}]'::jsonb, true),
  ('Network Capture', '🌐', 'PCAPs and traffic logs', '[{"key":"source","label":"Source","type":"text","required":false},{"key":"interface","label":"Interface","type":"text","required":false},{"key":"notes","label":"Notes","type":"text","required":false}]'::jsonb, true),
  ('Code Snippet', '💻', 'Payloads, exploits, scripts', '[{"key":"language","label":"Language","type":"text","required":false},{"key":"code","label":"Code","type":"code","required":true},{"key":"notes","label":"Notes","type":"text","required":false}]'::jsonb, true),
  ('Terminal Output', '⬛', 'Command logs and tool output', '[{"key":"command","label":"Command","type":"code","required":false},{"key":"output","label":"Output","type":"code","required":true}]'::jsonb, true),
  ('Note', '📝', 'Freeform text notes', '[{"key":"content","label":"Content","type":"text","required":true}]'::jsonb, true),
  ('Link', '🔗', 'External URLs and references', '[{"key":"url","label":"URL","type":"url","required":true},{"key":"notes","label":"Notes","type":"text","required":false}]'::jsonb, true),
  ('Encrypted Note', '🔒', 'Sensitive text stored encrypted', '[{"key":"content","label":"Content","type":"secret","required":true}]'::jsonb, true);
