CREATE TABLE "domain_resolutions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL,
  "domain" varchar(255) NOT NULL,
  "ip" varchar(45),
  "geolocation_id" uuid,
  "resolve_error" varchar(255),
  "resolved_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "domain_resolution_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "resolution_id" uuid NOT NULL,
  "source_type" "ip_source_type" NOT NULL,
  "source_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "domain_resolutions" ADD CONSTRAINT "domain_resolutions_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_resolutions" ADD CONSTRAINT "domain_resolutions_geolocation_id_ip_geolocations_id_fk" FOREIGN KEY ("geolocation_id") REFERENCES "public"."ip_geolocations"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "domain_resolution_sources" ADD CONSTRAINT "domain_res_sources_resolution_id_domain_resolutions_id_fk" FOREIGN KEY ("resolution_id") REFERENCES "public"."domain_resolutions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "domain_res_engagement_domain_ip_idx" ON "domain_resolutions" USING btree ("engagement_id", "domain", "ip");
--> statement-breakpoint
CREATE INDEX "domain_res_engagement_idx" ON "domain_resolutions" USING btree ("engagement_id");
--> statement-breakpoint
CREATE INDEX "domain_res_geolocation_idx" ON "domain_resolutions" USING btree ("geolocation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "domain_res_sources_unique_idx" ON "domain_resolution_sources" USING btree ("resolution_id", "source_type", "source_id");
--> statement-breakpoint
CREATE INDEX "domain_res_sources_source_idx" ON "domain_resolution_sources" USING btree ("source_type", "source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "domain_res_engagement_domain_null_ip_idx" ON "domain_resolutions" ("engagement_id", "domain") WHERE "ip" IS NULL;
