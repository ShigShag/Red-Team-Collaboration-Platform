-- Scoping & Rules of Engagement

CREATE TYPE "public"."scope_target_type" AS ENUM(
  'ip', 'cidr', 'domain', 'url', 'application', 'network'
);
--> statement-breakpoint

CREATE TYPE "public"."scope_document_type" AS ENUM(
  'authorization_letter', 'msa', 'sow', 'nda', 'other'
);
--> statement-breakpoint

CREATE TABLE "scope_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "type" "scope_target_type" NOT NULL,
  "value" varchar(500) NOT NULL,
  "notes" text,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "scope_targets_engagement_idx" ON "scope_targets" USING btree ("engagement_id");
--> statement-breakpoint
CREATE INDEX "scope_targets_type_idx" ON "scope_targets" USING btree ("engagement_id", "type");
--> statement-breakpoint

CREATE TABLE "scope_exclusions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "type" "scope_target_type" NOT NULL,
  "value" varchar(500) NOT NULL,
  "justification" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "scope_exclusions_engagement_idx" ON "scope_exclusions" USING btree ("engagement_id");
--> statement-breakpoint

CREATE TABLE "scope_constraints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "constraint" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "scope_constraints_engagement_idx" ON "scope_constraints" USING btree ("engagement_id");
--> statement-breakpoint

CREATE TABLE "emergency_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "title" varchar(255),
  "email" varchar(255),
  "encrypted_phone" text,
  "is_primary" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "emergency_contacts_engagement_idx" ON "emergency_contacts" USING btree ("engagement_id");
--> statement-breakpoint

CREATE TABLE "scope_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "document_type" "scope_document_type" NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "reference_number" varchar(100),
  "disk_path" varchar(500) NOT NULL,
  "original_filename" varchar(500) NOT NULL,
  "mime_type" varchar(255) NOT NULL,
  "file_size" bigint NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "scope_documents_engagement_idx" ON "scope_documents" USING btree ("engagement_id");
--> statement-breakpoint

ALTER TYPE "activity_event_type" ADD VALUE 'scope_target_added';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'scope_target_removed';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'scope_exclusion_added';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'scope_exclusion_removed';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'scope_constraint_added';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'scope_constraint_removed';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'emergency_contact_added';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'emergency_contact_removed';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'scope_document_uploaded';
--> statement-breakpoint
ALTER TYPE "activity_event_type" ADD VALUE 'scope_document_removed';
