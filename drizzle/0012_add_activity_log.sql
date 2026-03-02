-- Activity Timeline: engagement-scoped event log for audit/timeline display

CREATE TYPE "public"."activity_event_type" AS ENUM(
  'category_created',
  'category_deleted',
  'resource_created',
  'resource_updated',
  'resource_deleted',
  'action_created',
  'action_deleted',
  'member_joined',
  'member_removed',
  'member_role_changed',
  'member_assigned',
  'member_unassigned'
);
--> statement-breakpoint

CREATE TABLE "engagement_activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "event_type" "activity_event_type" NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "engagement_activity_log"
  ADD CONSTRAINT "engagement_activity_log_engagement_id_engagements_id_fk"
  FOREIGN KEY ("engagement_id")
  REFERENCES "public"."engagements"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "engagement_activity_log"
  ADD CONSTRAINT "engagement_activity_log_actor_id_users_id_fk"
  FOREIGN KEY ("actor_id")
  REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "activity_log_engagement_idx"
  ON "engagement_activity_log" USING btree ("engagement_id");
--> statement-breakpoint

CREATE INDEX "activity_log_engagement_time_idx"
  ON "engagement_activity_log" USING btree ("engagement_id", "created_at");
