CREATE TABLE IF NOT EXISTS "methodology_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "category" "finding_template_category" DEFAULT 'general' NOT NULL,
  "content" text NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "methodology_templates"
  ADD CONSTRAINT "methodology_templates_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "methodology_templates_category_idx"
  ON "methodology_templates" USING btree ("category");
CREATE INDEX IF NOT EXISTS "methodology_templates_name_idx"
  ON "methodology_templates" USING btree ("name");
