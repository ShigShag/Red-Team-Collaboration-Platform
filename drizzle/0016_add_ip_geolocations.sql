CREATE TYPE "public"."ip_source_type" AS ENUM ('resource', 'action');
--> statement-breakpoint
CREATE TABLE "ip_geolocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "engagement_id" uuid NOT NULL,
  "ip" varchar(45) NOT NULL,
  "country_code" varchar(2),
  "country_name" varchar(100),
  "is_manual" boolean NOT NULL DEFAULT false,
  "is_private" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ip_geolocation_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "geolocation_id" uuid NOT NULL,
  "source_type" "ip_source_type" NOT NULL,
  "source_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ip_geolocations" ADD CONSTRAINT "ip_geolocations_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ip_geolocation_sources" ADD CONSTRAINT "ip_geo_sources_geolocation_id_ip_geolocations_id_fk" FOREIGN KEY ("geolocation_id") REFERENCES "public"."ip_geolocations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ip_geolocations_engagement_ip_idx" ON "ip_geolocations" USING btree ("engagement_id", "ip");
--> statement-breakpoint
CREATE INDEX "ip_geolocations_engagement_idx" ON "ip_geolocations" USING btree ("engagement_id");
--> statement-breakpoint
CREATE INDEX "ip_geolocations_country_idx" ON "ip_geolocations" USING btree ("country_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "ip_geo_sources_unique_idx" ON "ip_geolocation_sources" USING btree ("geolocation_id", "source_type", "source_id");
--> statement-breakpoint
CREATE INDEX "ip_geo_sources_source_idx" ON "ip_geolocation_sources" USING btree ("source_type", "source_id");
