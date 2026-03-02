-- Add parent_id to engagement_categories for sub-category support
ALTER TABLE "engagement_categories" ADD COLUMN "parent_id" uuid;
--> statement-breakpoint
ALTER TABLE "engagement_categories" ADD CONSTRAINT "engagement_categories_parent_id_engagement_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."engagement_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "engagement_categories_parent_idx" ON "engagement_categories" USING btree ("parent_id");
--> statement-breakpoint

-- Create resource_type enum
CREATE TYPE "public"."resource_type" AS ENUM('file', 'screenshot', 'scan_output', 'link', 'note');
--> statement-breakpoint

-- Create category_resources table
CREATE TABLE "category_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"type" "resource_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"file_path" varchar(500),
	"url" varchar(2000),
	"metadata" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_resources" ADD CONSTRAINT "category_resources_category_id_engagement_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."engagement_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "category_resources" ADD CONSTRAINT "category_resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "category_resources_category_idx" ON "category_resources" USING btree ("category_id");
--> statement-breakpoint

-- Create category_actions table
CREATE TABLE "category_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_actions" ADD CONSTRAINT "category_actions_category_id_engagement_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."engagement_categories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "category_actions" ADD CONSTRAINT "category_actions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "category_actions_category_idx" ON "category_actions" USING btree ("category_id");
--> statement-breakpoint

-- Create action_resources junction table
CREATE TABLE "action_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_resources" ADD CONSTRAINT "action_resources_action_id_category_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."category_actions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "action_resources" ADD CONSTRAINT "action_resources_resource_id_category_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."category_resources"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "action_resources_unique_idx" ON "action_resources" USING btree ("action_id","resource_id");
--> statement-breakpoint
CREATE INDEX "action_resources_action_idx" ON "action_resources" USING btree ("action_id");
--> statement-breakpoint
CREATE INDEX "action_resources_resource_idx" ON "action_resources" USING btree ("resource_id");
