-- Rename emergency_contacts table to contacts
ALTER TABLE "emergency_contacts" RENAME TO "contacts";

-- Rename index
ALTER INDEX "emergency_contacts_engagement_idx" RENAME TO "contacts_engagement_idx";

-- Add new enum values for activity events (Postgres cannot drop enum values)
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'contact_added';
ALTER TYPE "activity_event_type" ADD VALUE IF NOT EXISTS 'contact_removed';
