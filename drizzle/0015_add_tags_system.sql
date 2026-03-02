CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"mitre_id" varchar(20),
	"tactic" varchar(100),
	"description" text,
	"is_system" boolean NOT NULL DEFAULT false,
	"created_by" uuid,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "action_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_tags" ADD CONSTRAINT "action_tags_action_id_category_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."category_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_tags" ADD CONSTRAINT "action_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_mitre_id_unique_idx" ON "tags" USING btree ("mitre_id");--> statement-breakpoint
CREATE INDEX "tags_tactic_idx" ON "tags" USING btree ("tactic");--> statement-breakpoint
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "action_tags_unique_idx" ON "action_tags" USING btree ("action_id","tag_id");--> statement-breakpoint
CREATE INDEX "action_tags_action_idx" ON "action_tags" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "action_tags_tag_idx" ON "action_tags" USING btree ("tag_id");
