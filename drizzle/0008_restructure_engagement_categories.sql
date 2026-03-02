-- Rename notes to description
ALTER TABLE "engagement_categories" RENAME COLUMN "notes" TO "description";
--> statement-breakpoint
-- Drop icon column (comes from preset now)
ALTER TABLE "engagement_categories" DROP COLUMN "icon";
--> statement-breakpoint
-- Make preset_id NOT NULL (delete any orphan rows first)
DELETE FROM "engagement_categories" WHERE "preset_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "engagement_categories" ALTER COLUMN "preset_id" SET NOT NULL;
--> statement-breakpoint
-- Change FK on preset_id from SET NULL to RESTRICT
ALTER TABLE "engagement_categories" DROP CONSTRAINT "engagement_categories_preset_id_category_presets_id_fk";
--> statement-breakpoint
ALTER TABLE "engagement_categories" ADD CONSTRAINT "engagement_categories_preset_id_category_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."category_presets"("id") ON DELETE restrict ON UPDATE no action;
